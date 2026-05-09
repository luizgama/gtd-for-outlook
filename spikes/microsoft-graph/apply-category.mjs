import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");
const TARGET_FOLDER_NAME = "@Action";
const TARGET_CATEGORY = "GTD: Action";

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

async function getMasterCategory(accessToken, name) {
  const escaped = name.replace(/'/g, "''");
  const result = await graphRequest(
    accessToken,
    `/me/outlook/masterCategories?$top=100&$filter=displayName eq '${escaped}'&$select=id,displayName,color`,
  );
  if (!result.ok) {
    throw new Error(
      `Master category lookup failed (${result.status} ${result.statusText}): ${result.text}`,
    );
  }
  const categories = Array.isArray(result.json?.value) ? result.json.value : [];
  return categories[0] ?? null;
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

console.log("Starting Microsoft Graph B13 apply-category validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const accessToken = await acquireTokenSilent(app);
const targetFolder = await findFolderByName(accessToken, TARGET_FOLDER_NAME);
if (!targetFolder?.id) {
  throw new Error(`Target folder '${TARGET_FOLDER_NAME}' not found.`);
}

const folderMessages = await graphRequest(
  accessToken,
  `/me/mailFolders/${encodeURIComponent(targetFolder.id)}/messages?$top=10&$select=id,subject,categories,receivedDateTime&$orderby=receivedDateTime desc`,
);
if (!folderMessages.ok) {
  throw new Error(
    `Folder message listing failed (${folderMessages.status} ${folderMessages.statusText}): ${folderMessages.text}`,
  );
}
const messages = Array.isArray(folderMessages.json?.value) ? folderMessages.json.value : [];
const candidate = messages[0];
if (!candidate?.id) {
  throw new Error(`No messages found in '${TARGET_FOLDER_NAME}' to validate B13.`);
}

const originalCategories = Array.isArray(candidate.categories) ? candidate.categories : [];
const requestedCategories = Array.from(new Set([...originalCategories, TARGET_CATEGORY]));
const firstPatch = await graphRequest(
  accessToken,
  `/me/messages/${encodeURIComponent(candidate.id)}`,
  "PATCH",
  { categories: requestedCategories },
);

let preCreationRequired = null;
let createdMasterCategory = false;
let patchStatus = firstPatch.ok ? "applied_without_master_create" : "rejected";
let patchError = null;

if (!firstPatch.ok) {
  patchError = {
    status: firstPatch.status,
    statusText: firstPatch.statusText,
    code: firstPatch.json?.error?.code ?? null,
    message: firstPatch.json?.error?.message ?? firstPatch.text,
  };

  const existingMaster = await getMasterCategory(accessToken, TARGET_CATEGORY);
  if (!existingMaster) {
    const createMaster = await graphRequest(accessToken, "/me/outlook/masterCategories", "POST", {
      displayName: TARGET_CATEGORY,
      color: "preset0",
    });
    if (!createMaster.ok) {
      throw new Error(
        `Master category create failed (${createMaster.status} ${createMaster.statusText}): ${createMaster.text}`,
      );
    }
    createdMasterCategory = true;
  }

  const secondPatch = await graphRequest(
    accessToken,
    `/me/messages/${encodeURIComponent(candidate.id)}`,
    "PATCH",
    { categories: requestedCategories },
  );
  if (!secondPatch.ok) {
    throw new Error(
      `Category patch failed after master category check (${secondPatch.status} ${secondPatch.statusText}): ${secondPatch.text}`,
    );
  }
  patchStatus = "applied_after_master_create_check";
  preCreationRequired = true;
} else {
  preCreationRequired = false;
}

const verify = await graphRequest(
  accessToken,
  `/me/messages/${encodeURIComponent(candidate.id)}?$select=id,subject,categories,parentFolderId`,
);
if (!verify.ok) {
  throw new Error(
    `Category verification read failed (${verify.status} ${verify.statusText}): ${verify.text}`,
  );
}
const verifiedCategories = Array.isArray(verify.json?.categories) ? verify.json.categories : [];
const categoryApplied = verifiedCategories.includes(TARGET_CATEGORY);

console.log(
  JSON.stringify(
    {
      targetFolderName: TARGET_FOLDER_NAME,
      targetFolderId: targetFolder.id,
      targetCategory: TARGET_CATEGORY,
      selectedMessageId: candidate.id ?? null,
      selectedMessageSubject: candidate.subject ?? null,
      patchStatus,
      patchError,
      preCreationRequired,
      createdMasterCategory,
      originalCategories,
      verifiedCategories,
      categoryApplied,
    },
    null,
    2,
  ),
);

if (!categoryApplied) {
  throw new Error("Category was not applied after PATCH validation.");
}

console.log("B13 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
