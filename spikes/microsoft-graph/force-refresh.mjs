import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");

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

function tokenFingerprint(token) {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

function ensurePrivateFile(path, contents) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, contents, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function fileMode(path) {
  return (statSync(path).mode & 0o777).toString(8).padStart(3, "0");
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

    async afterCacheAccess(cacheContext) {
      if (!cacheContext.cacheHasChanged) {
        return;
      }

      ensurePrivateFile(cachePath, cacheContext.tokenCache.serialize());
    },
  };
}

async function acquireSilent(app, account, forceRefresh) {
  const result = await app.acquireTokenSilent({
    account,
    scopes: [GRAPH_SCOPE],
    forceRefresh,
  });

  if (!result?.accessToken) {
    throw new Error(`Silent auth returned no access token (forceRefresh=${forceRefresh}).`);
  }

  if (!result.scopes?.includes(GRAPH_SCOPE)) {
    throw new Error(`Expected granted scope ${GRAPH_SCOPE}.`);
  }

  return result;
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

console.log("Starting Microsoft Graph force-refresh validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const accounts = await app.getTokenCache().getAllAccounts();
const account = accounts[0];
if (!account) {
  throw new Error("No account found in token cache. Run auth-cache.mjs first.");
}

const cachedResult = await acquireSilent(app, account, false);
const refreshedResult = await acquireSilent(app, account, true);

const mode = fileMode(cachePath);
if (mode !== "600") {
  throw new Error(`Expected token cache mode 600, got ${mode}.`);
}

console.log("Force-refresh validation succeeded.");
console.log(
  JSON.stringify(
    {
      accountUsername: refreshedResult.account?.username ?? null,
      tenantId: refreshedResult.tenantId ?? null,
      scopes: refreshedResult.scopes ?? [],
      cachedAccessTokenReturned: true,
      refreshedAccessTokenReturned: true,
      cachedTokenFingerprint: tokenFingerprint(cachedResult.accessToken),
      refreshedTokenFingerprint: tokenFingerprint(refreshedResult.accessToken),
      cachedExpiresOn: cachedResult.expiresOn?.toISOString() ?? null,
      refreshedExpiresOn: refreshedResult.expiresOn?.toISOString() ?? null,
      cachePath,
      cacheFileMode: mode,
    },
    null,
    2,
  ),
);

console.log("B4 acceptance passed: forceRefresh silent auth returned a Mail.ReadWrite token without browser interaction.");
