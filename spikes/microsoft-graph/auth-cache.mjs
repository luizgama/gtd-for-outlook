import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
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

async function acquireToken(app) {
  const accounts = await app.getTokenCache().getAllAccounts();
  const account = accounts[0];

  if (account) {
    try {
      const result = await app.acquireTokenSilent({
        account,
        scopes: [GRAPH_SCOPE],
      });
      if (result?.accessToken) {
        return { result, authMode: "silent" };
      }
    } catch (error) {
      console.error(`Silent auth failed, falling back to device code: ${error}`);
    }
  }

  const result = await app.acquireTokenByDeviceCode({
    scopes: [GRAPH_SCOPE],
    deviceCodeCallback: (response) => {
      console.log("");
      console.log("Open the following URL and enter the code:");
      console.log(response.verificationUri);
      console.log(`Code: ${response.userCode}`);
      console.log("");
      console.log(response.message);
      console.log("");
    },
  });

  return { result, authMode: "device-code" };
}

loadDotEnv();

const clientId = requireEnv("GRAPH_CLIENT_ID");
const tenantId = requireEnv("GRAPH_TENANT_ID");
const cachePath = process.env.GTD_OUTLOOK_TOKEN_CACHE_PATH?.trim() || DEFAULT_CACHE_PATH;
const authority = `https://login.microsoftonline.com/${tenantId}`;

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

console.log("Starting Microsoft Graph auth-cache validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const { result, authMode } = await acquireToken(app);

if (!result?.accessToken) {
  throw new Error("MSAL did not return an access token.");
}

if (!existsSync(cachePath)) {
  ensurePrivateFile(cachePath, app.getTokenCache().serialize());
}

const mode = fileMode(cachePath);
if (mode !== "600") {
  throw new Error(`Expected token cache mode 600, got ${mode}.`);
}

console.log("Authentication succeeded.");
console.log(
  JSON.stringify(
    {
      authMode,
      accountUsername: result.account?.username ?? null,
      tenantId: result.tenantId ?? null,
      scopes: result.scopes ?? [],
      expiresOn: result.expiresOn?.toISOString() ?? null,
      accessTokenReturned: true,
      accessTokenLength: result.accessToken.length,
      idTokenReturned: Boolean(result.idToken),
      cachePath,
      cacheFileMode: mode,
    },
    null,
    2,
  ),
);

if (!result.scopes?.includes(GRAPH_SCOPE)) {
  throw new Error(`Expected granted scope ${GRAPH_SCOPE}.`);
}

console.log("B3 acceptance passed when authMode is silent on a restarted run.");
