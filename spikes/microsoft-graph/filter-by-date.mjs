import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");
const DEFAULT_SINCE = "2026-04-01T00:00:00Z";
const DEFAULT_TOP = 20;

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

async function graphGet(accessToken, pathWithQuery) {
  const response = await fetch(`${GRAPH_BASE}${pathWithQuery}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph request failed (${response.status} ${response.statusText}): ${text}`);
  }
  return response.json();
}

function toMillis(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

loadDotEnv();

const clientId = requireEnv("GRAPH_CLIENT_ID");
const tenantId = requireEnv("GRAPH_TENANT_ID");
const cachePath = process.env.GTD_OUTLOOK_TOKEN_CACHE_PATH?.trim() || DEFAULT_CACHE_PATH;
const authority = `https://login.microsoftonline.com/${tenantId}`;
const since = process.env.B15_SINCE?.trim() || DEFAULT_SINCE;
const top = Number.parseInt(process.env.B15_TOP?.trim() || `${DEFAULT_TOP}`, 10);
const sinceMs = toMillis(since);

if (!existsSync(cachePath)) {
  throw new Error(`Token cache not found at ${cachePath}. Run auth-cache.mjs first.`);
}
if (!Number.isFinite(sinceMs)) {
  throw new Error(`Invalid B15_SINCE/DEFAULT_SINCE value: ${since}`);
}
if (!Number.isFinite(top) || top < 1 || top > 100) {
  throw new Error(`Invalid B15_TOP value: ${top}. Expected integer 1..100.`);
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

console.log("Starting Microsoft Graph B15 filter-by-date validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);
console.log(`since: ${since}`);
console.log(`top: ${top}`);

const accessToken = await acquireTokenSilent(app);
const query = new URLSearchParams({
  "$top": `${top}`,
  "$filter": `receivedDateTime ge ${since}`,
  "$orderby": "receivedDateTime desc",
  "$select": "id,subject,receivedDateTime,parentFolderId",
});
const payload = await graphGet(accessToken, `/me/messages?${query.toString()}`);
const messages = Array.isArray(payload.value) ? payload.value : [];

let allAfterSince = true;
let sortedDescending = true;
let firstOutOfRange = null;
let firstOrderViolation = null;

for (let i = 0; i < messages.length; i += 1) {
  const current = messages[i];
  const currentMs = toMillis(current.receivedDateTime ?? "");
  if (!Number.isFinite(currentMs) || currentMs < sinceMs) {
    allAfterSince = false;
    if (!firstOutOfRange) {
      firstOutOfRange = {
        index: i,
        receivedDateTime: current.receivedDateTime ?? null,
        id: current.id ?? null,
      };
    }
  }
  if (i < messages.length - 1) {
    const next = messages[i + 1];
    const nextMs = toMillis(next.receivedDateTime ?? "");
    if (Number.isFinite(currentMs) && Number.isFinite(nextMs) && currentMs < nextMs) {
      sortedDescending = false;
      if (!firstOrderViolation) {
        firstOrderViolation = {
          index: i,
          currentReceivedDateTime: current.receivedDateTime ?? null,
          nextReceivedDateTime: next.receivedDateTime ?? null,
          currentId: current.id ?? null,
          nextId: next.id ?? null,
        };
      }
    }
  }
}

console.log(
  JSON.stringify(
    {
      since,
      top,
      returnedCount: messages.length,
      allAfterSince,
      sortedDescending,
      firstOutOfRange,
      firstOrderViolation,
      hasNextLink: typeof payload["@odata.nextLink"] === "string",
      sampleMessages: messages.slice(0, 10).map((m) => ({
        id: m.id ?? null,
        subject: m.subject ?? null,
        receivedDateTime: m.receivedDateTime ?? null,
      })),
    },
    null,
    2,
  ),
);

if (!allAfterSince) {
  throw new Error("Date filter validation failed: at least one message is older than 'since'.");
}
if (!sortedDescending) {
  throw new Error("Order validation failed: results are not sorted by newest-first.");
}

console.log("B15 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
