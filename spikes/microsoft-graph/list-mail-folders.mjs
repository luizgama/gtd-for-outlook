import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");
const TARGET_PARENT = "@Action";
const TARGET_CHILD = "Urgent";

function loadDotEnv(path = DEFAULT_ENV_PATH) {
  if (!existsSync(path)) {
    return;
  }
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Add it to .env or the environment.`);
  }
  return value;
}

function redact(value) {
  if (!value) {
    return "<empty>";
  }
  if (value.length <= 8) {
    return "<redacted>";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function createFileCachePlugin(cachePath) {
  return {
    async beforeCacheAccess(cacheContext) {
      if (!existsSync(cachePath)) {
        return;
      }
      const cache = readFileSync(cachePath, "utf8");
      if (cache.trim()) {
        cacheContext.tokenCache.deserialize(cache);
      }
    },
    async afterCacheAccess() {
      // Read-only spike script.
    },
  };
}

async function acquireTokenSilent(app) {
  const accounts = await app.getTokenCache().getAllAccounts();
  const account = accounts[0];
  if (!account) {
    throw new Error("No account found in token cache. Run auth-cache.mjs first.");
  }
  const result = await app.acquireTokenSilent({
    account,
    scopes: [GRAPH_SCOPE],
  });
  if (!result?.accessToken) {
    throw new Error("Silent auth did not return an access token.");
  }
  if (!result.scopes?.includes(GRAPH_SCOPE)) {
    throw new Error(`Expected granted scope ${GRAPH_SCOPE}.`);
  }
  return result.accessToken;
}

async function graphGet(accessToken, pathWithQuery) {
  const response = await fetch(`${GRAPH_BASE}${pathWithQuery}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph request failed (${response.status} ${response.statusText}): ${text}`);
  }
  return response.json();
}

async function listTopLevelFolders(accessToken) {
  const folders = [];
  let nextPath =
    "/me/mailFolders?$top=100&$select=id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount";

  while (nextPath) {
    const payload = await graphGet(accessToken, nextPath);
    const page = Array.isArray(payload.value) ? payload.value : [];
    folders.push(...page);
    const nextLink = payload["@odata.nextLink"];
    if (typeof nextLink === "string" && nextLink.startsWith(`${GRAPH_BASE}/`)) {
      nextPath = nextLink.slice(GRAPH_BASE.length);
    } else {
      nextPath = null;
    }
  }

  return folders;
}

async function listChildFolders(accessToken, parentId) {
  const encodedParentId = encodeURIComponent(parentId);
  const payload = await graphGet(
    accessToken,
    `/me/mailFolders/${encodedParentId}/childFolders?$top=100&$select=id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount`,
  );
  return Array.isArray(payload.value) ? payload.value : [];
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

console.log("Starting Microsoft Graph B11 list-mail-folders validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const accessToken = await acquireTokenSilent(app);
const topLevelFolders = await listTopLevelFolders(accessToken);
const parent = topLevelFolders.find((folder) => folder.displayName === TARGET_PARENT) ?? null;
const childFolders = parent?.id ? await listChildFolders(accessToken, parent.id) : [];
const child = childFolders.find((folder) => folder.displayName === TARGET_CHILD) ?? null;

console.log(
  JSON.stringify(
    {
      topLevelFolderCount: topLevelFolders.length,
      actionFolderFound: Boolean(parent),
      actionFolderId: parent?.id ?? null,
      actionFolderChildCount: parent?.childFolderCount ?? null,
      urgentChildFound: Boolean(child),
      urgentChildId: child?.id ?? null,
      urgentChildParentFolderId: child?.parentFolderId ?? null,
      sampleTopLevelFolders: topLevelFolders.slice(0, 20).map((folder) => ({
        id: folder.id ?? null,
        displayName: folder.displayName ?? null,
        childFolderCount: folder.childFolderCount ?? null,
        totalItemCount: folder.totalItemCount ?? null,
        unreadItemCount: folder.unreadItemCount ?? null,
      })),
    },
    null,
    2,
  ),
);

console.log("B11 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
