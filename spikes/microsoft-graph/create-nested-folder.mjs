import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");
const PARENT_FOLDER_NAME = "@Action";
const CHILD_FOLDER_NAME = "Urgent";

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
      // Spike script reads cache only.
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

async function findTopLevelFolderByName(accessToken, displayName) {
  const escaped = displayName.replace(/'/g, "''");
  const result = await graphRequest(
    accessToken,
    `/me/mailFolders?$top=50&$filter=displayName eq '${escaped}'&$select=id,displayName,parentFolderId,childFolderCount`,
  );
  if (!result.ok) {
    throw new Error(`Folder lookup failed (${result.status}): ${result.text}`);
  }
  const folders = Array.isArray(result.json?.value) ? result.json.value : [];
  return folders[0] ?? null;
}

async function createTopLevelFolder(accessToken, displayName) {
  return graphRequest(accessToken, "/me/mailFolders", "POST", { displayName });
}

async function findChildFolderByName(accessToken, parentId, displayName) {
  const escaped = displayName.replace(/'/g, "''");
  const encodedParentId = encodeURIComponent(parentId);
  const result = await graphRequest(
    accessToken,
    `/me/mailFolders/${encodedParentId}/childFolders?$top=50&$filter=displayName eq '${escaped}'&$select=id,displayName,parentFolderId,childFolderCount`,
  );
  if (!result.ok) {
    throw new Error(`Child folder lookup failed (${result.status}): ${result.text}`);
  }
  const folders = Array.isArray(result.json?.value) ? result.json.value : [];
  return folders[0] ?? null;
}

async function createChildFolder(accessToken, parentId, displayName) {
  const encodedParentId = encodeURIComponent(parentId);
  return graphRequest(accessToken, `/me/mailFolders/${encodedParentId}/childFolders`, "POST", {
    displayName,
  });
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

console.log("Starting Microsoft Graph B10 create-nested-folder validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const accessToken = await acquireTokenSilent(app);

let parentFolder = await findTopLevelFolderByName(accessToken, PARENT_FOLDER_NAME);
let parentStatus = "already_exists";
if (!parentFolder) {
  const createParent = await createTopLevelFolder(accessToken, PARENT_FOLDER_NAME);
  if (!createParent.ok) {
    throw new Error(
      `Failed to create parent folder (${createParent.status} ${createParent.statusText}): ${createParent.text}`,
    );
  }
  parentFolder = createParent.json;
  parentStatus = "created";
}

if (!parentFolder?.id) {
  throw new Error("Parent folder ID missing after lookup/create.");
}

let childFolder = await findChildFolderByName(accessToken, parentFolder.id, CHILD_FOLDER_NAME);
let childStatus = "already_exists";
if (!childFolder) {
  const createChild = await createChildFolder(accessToken, parentFolder.id, CHILD_FOLDER_NAME);
  if (!createChild.ok) {
    throw new Error(
      `Failed to create child folder (${createChild.status} ${createChild.statusText}): ${createChild.text}`,
    );
  }
  childFolder = createChild.json;
  childStatus = "created";
}

console.log(
  JSON.stringify(
    {
      parentFolderName: PARENT_FOLDER_NAME,
      parentStatus,
      parentFolderId: parentFolder.id ?? null,
      childFolderName: CHILD_FOLDER_NAME,
      childStatus,
      childFolderId: childFolder?.id ?? null,
      childParentFolderId: childFolder?.parentFolderId ?? null,
      nestedUnderExpectedParent: childFolder?.parentFolderId === parentFolder.id,
    },
    null,
    2,
  ),
);

console.log("B10 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
