import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");
const DEFAULT_REQUEST_COUNT = 30;
const DEFAULT_DELAY_MS = 0;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

loadDotEnv();

const clientId = requireEnv("GRAPH_CLIENT_ID");
const tenantId = requireEnv("GRAPH_TENANT_ID");
const cachePath = process.env.GTD_OUTLOOK_TOKEN_CACHE_PATH?.trim() || DEFAULT_CACHE_PATH;
const authority = `https://login.microsoftonline.com/${tenantId}`;
const requestCount = Number.parseInt(
  process.env.B14_REQUEST_COUNT?.trim() || `${DEFAULT_REQUEST_COUNT}`,
  10,
);
const delayMs = Number.parseInt(process.env.B14_DELAY_MS?.trim() || `${DEFAULT_DELAY_MS}`, 10);

if (!existsSync(cachePath)) {
  throw new Error(`Token cache not found at ${cachePath}. Run auth-cache.mjs first.`);
}
if (!Number.isFinite(requestCount) || requestCount < 1) {
  throw new Error(`Invalid B14_REQUEST_COUNT: ${requestCount}`);
}
if (!Number.isFinite(delayMs) || delayMs < 0) {
  throw new Error(`Invalid B14_DELAY_MS: ${delayMs}`);
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

console.log("Starting Microsoft Graph B14 rate-limit probe.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);
console.log(`requestCount: ${requestCount}`);
console.log(`delayMs: ${delayMs}`);

const accessToken = await acquireTokenSilent(app);
const path = "/me/messages?$top=1&$select=id,receivedDateTime";

const statusCounts = {};
const retryAfterValues = [];
let firstThrottleAt = null;
let throttled = false;

for (let i = 0; i < requestCount; i += 1) {
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  statusCounts[response.status] = (statusCounts[response.status] ?? 0) + 1;

  if (response.status === 429) {
    throttled = true;
    if (firstThrottleAt === null) firstThrottleAt = i + 1;
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) retryAfterValues.push(retryAfter);
  }

  if (response.status >= 400) {
    await response.text();
  } else {
    await response.arrayBuffer();
  }

  if (delayMs > 0 && i < requestCount - 1) {
    await sleep(delayMs);
  }
}

console.log(
  JSON.stringify(
    {
      requestCount,
      delayMs,
      statusCounts,
      throttled,
      firstThrottleAt,
      retryAfterValues,
    },
    null,
    2,
  ),
);

console.log("B14 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
