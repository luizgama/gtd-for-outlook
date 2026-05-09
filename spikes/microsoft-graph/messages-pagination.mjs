import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");
const PAGE_TOP = 5;
const DEFAULT_MAX_PAGES = 60;

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
    async afterCacheAccess() {},
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
      loggerCallback: (_level, message) => console.error(message),
    },
  },
});

console.log("Starting Microsoft Graph B8 messages-pagination validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);
console.log(`top: ${PAGE_TOP}`);
const maxPages = Number.parseInt(
  process.env.B8_MAX_PAGES?.trim() || `${DEFAULT_MAX_PAGES}`,
  10,
);
if (!Number.isFinite(maxPages) || maxPages < 1) {
  throw new Error(`Invalid B8_MAX_PAGES value: ${maxPages}`);
}
console.log(`maxPages: ${maxPages}`);

const accessToken = await acquireTokenSilent(app);
let nextPath =
  `/me/messages?$top=${PAGE_TOP}&$select=id,subject,receivedDateTime,parentFolderId&$orderby=receivedDateTime desc`;

let pageCount = 0;
let totalMessages = 0;
const ids = [];
const pageSizes = [];
const firstMessagePerPage = [];
const lastMessagePerPage = [];

while (nextPath && pageCount < maxPages) {
  const payload = await graphGet(accessToken, nextPath);
  const page = Array.isArray(payload.value) ? payload.value : [];
  pageCount += 1;
  pageSizes.push(page.length);
  totalMessages += page.length;

  if (page.length > 0) {
    firstMessagePerPage.push({
      page: pageCount,
      id: page[0].id ?? null,
      receivedDateTime: page[0].receivedDateTime ?? null,
    });
    const last = page[page.length - 1];
    lastMessagePerPage.push({
      page: pageCount,
      id: last.id ?? null,
      receivedDateTime: last.receivedDateTime ?? null,
    });
  }

  for (const message of page) {
    if (message.id) ids.push(message.id);
  }

  const nextLink = payload["@odata.nextLink"];
  if (typeof nextLink === "string" && nextLink.startsWith(`${GRAPH_BASE}/`)) {
    nextPath = nextLink.slice(GRAPH_BASE.length);
  } else {
    nextPath = null;
  }
}

const uniqueCount = new Set(ids).size;
const duplicateCount = ids.length - uniqueCount;
const traversedAllPages = nextPath === null;
const truncatedByMaxPages = nextPath !== null;
const multiPageTraversal = pageCount > 1;

console.log(
  JSON.stringify(
    {
      top: PAGE_TOP,
      maxPages,
      pageCount,
      totalMessages,
      uniqueCount,
      duplicateCount,
      traversedAllPages,
      truncatedByMaxPages,
      pageSizes,
      multiPageTraversal,
      firstMessagePerPage: firstMessagePerPage.slice(0, 10),
      lastMessagePerPage: lastMessagePerPage.slice(0, 10),
    },
    null,
    2,
  ),
);

if (duplicateCount > 0) {
  throw new Error(`Duplicate messages detected while paginating: ${duplicateCount}`);
}
if (!multiPageTraversal) {
  throw new Error("Expected more than one page while validating @odata.nextLink pagination.");
}

console.log("B8 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
