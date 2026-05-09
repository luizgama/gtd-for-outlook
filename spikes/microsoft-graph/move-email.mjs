import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");
const INBOX_NAME = "Caixa de Entrada";
const DEST_NAME = "@Action";

function loadDotEnv(path = DEFAULT_ENV_PATH) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Add it to .env or the environment.`);
  return value;
}

function redact(value) {
  if (!value) return "<empty>";
  if (value.length <= 8) return "<redacted>";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function createFileCachePlugin(cachePath) {
  return {
    async beforeCacheAccess(cacheContext) {
      if (!existsSync(cachePath)) return;
      const cache = readFileSync(cachePath, "utf8");
      if (cache.trim()) cacheContext.tokenCache.deserialize(cache);
    },
    async afterCacheAccess() {
      // Read-only cache usage.
    },
  };
}

async function acquireTokenSilent(app) {
  const accounts = await app.getTokenCache().getAllAccounts();
  const account = accounts[0];
  if (!account) throw new Error("No account found in token cache. Run auth-cache.mjs first.");
  const result = await app.acquireTokenSilent({ account, scopes: [GRAPH_SCOPE] });
  if (!result?.accessToken) throw new Error("Silent auth did not return an access token.");
  if (!result.scopes?.includes(GRAPH_SCOPE)) {
    throw new Error(`Expected granted scope ${GRAPH_SCOPE}.`);
  }
  return result.accessToken;
}

async function graphRequest(accessToken, pathWithQuery, method = "GET", body) {
  const response = await fetch(`${GRAPH_BASE}${pathWithQuery}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { ok: response.ok, status: response.status, statusText: response.statusText, text, json };
}

async function findFolderByName(accessToken, displayName) {
  const escaped = displayName.replace(/'/g, "''");
  const result = await graphRequest(
    accessToken,
    `/me/mailFolders?$top=100&$filter=displayName eq '${escaped}'&$select=id,displayName`,
  );
  if (!result.ok) {
    throw new Error(`Folder lookup failed (${result.status} ${result.statusText}): ${result.text}`);
  }
  const folders = Array.isArray(result.json?.value) ? result.json.value : [];
  return folders[0] ?? null;
}

loadDotEnv();

const clientId = requireEnv("GRAPH_CLIENT_ID");
const tenantId = requireEnv("GRAPH_TENANT_ID");
const cachePath = process.env.GTD_OUTLOOK_TOKEN_CACHE_PATH?.trim() || DEFAULT_CACHE_PATH;
const authority = `https://login.microsoftonline.com/${tenantId}`;

if (!existsSync(cachePath)) {
  throw new Error(`Token cache not found at ${cachePath}. Run auth-cache.mjs first.`);
}

const app = new PublicClientApplication({
  auth: { clientId, authority },
  cache: { cachePlugin: createFileCachePlugin(cachePath) },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: (_level, message) => {
        console.error(message);
      },
    },
  },
});

console.log("Starting Microsoft Graph B12 move-email validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const accessToken = await acquireTokenSilent(app);
const inbox = await findFolderByName(accessToken, INBOX_NAME);
const destination = await findFolderByName(accessToken, DEST_NAME);
if (!inbox?.id) throw new Error(`Inbox folder '${INBOX_NAME}' not found.`);
if (!destination?.id) throw new Error(`Destination folder '${DEST_NAME}' not found.`);

const inboxMessages = await graphRequest(
  accessToken,
  `/me/mailFolders/${encodeURIComponent(inbox.id)}/messages?$top=10&$select=id,subject,parentFolderId,receivedDateTime&$orderby=receivedDateTime desc`,
);
if (!inboxMessages.ok) {
  throw new Error(
    `Inbox message listing failed (${inboxMessages.status} ${inboxMessages.statusText}): ${inboxMessages.text}`,
  );
}
const messages = Array.isArray(inboxMessages.json?.value) ? inboxMessages.json.value : [];
const candidate = messages[0];
if (!candidate?.id) throw new Error("No Inbox message found to move for B12 validation.");

const moveResult = await graphRequest(
  accessToken,
  `/me/messages/${encodeURIComponent(candidate.id)}/move`,
  "POST",
  { destinationId: destination.id },
);
if (!moveResult.ok) {
  throw new Error(`Move failed (${moveResult.status} ${moveResult.statusText}): ${moveResult.text}`);
}

const movedId = moveResult.json?.id ?? null;
const movedParentFolderId = moveResult.json?.parentFolderId ?? null;
if (!movedId) {
  throw new Error("Move returned no message id.");
}

const movedDetail = await graphRequest(
  accessToken,
  `/me/messages/${encodeURIComponent(movedId)}?$select=id,subject,parentFolderId`,
);
if (!movedDetail.ok) {
  throw new Error(
    `Moved message lookup failed (${movedDetail.status} ${movedDetail.statusText}): ${movedDetail.text}`,
  );
}

const verifiedParentFolderId = movedDetail.json?.parentFolderId ?? null;
const movedToDestination =
  movedParentFolderId === destination.id && verifiedParentFolderId === destination.id;

console.log(
  JSON.stringify(
    {
      sourceFolderName: INBOX_NAME,
      sourceFolderId: inbox.id,
      destinationFolderName: DEST_NAME,
      destinationFolderId: destination.id,
      selectedMessageId: candidate.id ?? null,
      selectedMessageSubject: candidate.subject ?? null,
      moveReturnedMessageId: movedId,
      moveReturnedParentFolderId: movedParentFolderId,
      verifiedParentFolderId,
      movedToDestination,
    },
    null,
    2,
  ),
);

if (!movedToDestination) {
  throw new Error("Moved message parentFolderId does not match destination folder id.");
}

console.log("B12 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
