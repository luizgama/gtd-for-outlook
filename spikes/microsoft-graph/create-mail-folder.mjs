import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");
const PRIMARY_FOLDER_NAME = "@Action";
const FALLBACK_FOLDER_NAME = "GTD-Action";

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
      // Read-only spike script: no cache writes needed for B9.
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

  return { ok: response.ok, status: response.status, statusText: response.statusText, json, text };
}

async function findFolderByName(accessToken, displayName) {
  const escaped = displayName.replace(/'/g, "''");
  const result = await graphRequest(
    accessToken,
    `/me/mailFolders?$top=50&$filter=displayName eq '${escaped}'&$select=id,displayName,parentFolderId,totalItemCount,childFolderCount`,
  );
  if (!result.ok) {
    throw new Error(
      `Folder lookup failed (${result.status} ${result.statusText}): ${result.text}`,
    );
  }
  const folders = Array.isArray(result.json?.value) ? result.json.value : [];
  return folders[0] ?? null;
}

async function createFolder(accessToken, displayName) {
  return graphRequest(accessToken, "/me/mailFolders", "POST", { displayName });
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
  auth: {
    clientId,
    authority,
  },
  cache: {
    cachePlugin: createFileCachePlugin(cachePath),
  },
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

console.log("Starting Microsoft Graph B9 create-mail-folder validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const accessToken = await acquireTokenSilent(app);
const existingPrimary = await findFolderByName(accessToken, PRIMARY_FOLDER_NAME);

let primaryResult;
if (existingPrimary) {
  primaryResult = {
    status: "already_exists",
    folder: existingPrimary,
  };
} else {
  const created = await createFolder(accessToken, PRIMARY_FOLDER_NAME);
  if (created.ok) {
    primaryResult = {
      status: "created",
      folder: created.json,
    };
  } else {
    primaryResult = {
      status: "rejected",
      error: {
        status: created.status,
        statusText: created.statusText,
        code: created.json?.error?.code ?? null,
        message: created.json?.error?.message ?? created.text,
      },
    };
  }
}

let fallbackResult = null;
if (primaryResult.status === "rejected") {
  const existingFallback = await findFolderByName(accessToken, FALLBACK_FOLDER_NAME);
  if (existingFallback) {
    fallbackResult = {
      status: "already_exists",
      folder: existingFallback,
    };
  } else {
    const fallbackCreate = await createFolder(accessToken, FALLBACK_FOLDER_NAME);
    if (fallbackCreate.ok) {
      fallbackResult = {
        status: "created",
        folder: fallbackCreate.json,
      };
    } else {
      fallbackResult = {
        status: "rejected",
        error: {
          status: fallbackCreate.status,
          statusText: fallbackCreate.statusText,
          code: fallbackCreate.json?.error?.code ?? null,
          message: fallbackCreate.json?.error?.message ?? fallbackCreate.text,
        },
      };
    }
  }
}

console.log(
  JSON.stringify(
    {
      primaryFolderName: PRIMARY_FOLDER_NAME,
      primaryResult,
      fallbackFolderName: FALLBACK_FOLDER_NAME,
      fallbackResult,
    },
    null,
    2,
  ),
);

console.log("B9 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
