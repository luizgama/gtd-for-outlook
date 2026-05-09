import { PublicClientApplication } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_ENV_PATH = ".env";
const DEFAULT_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");

function loadDotEnv(path = DEFAULT_ENV_PATH) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function createFileCachePlugin(path) {
  return {
    async beforeCacheAccess(ctx) {
      if (!existsSync(path)) return;
      const cache = readFileSync(path, "utf8");
      if (cache.trim()) ctx.tokenCache.deserialize(cache);
    },
    async afterCacheAccess() {},
  };
}

async function graph(accessToken, path, method = "GET", body) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text.trim() ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  return json;
}

async function getOrCreateActionFolder(accessToken) {
  const lookup = await graph(
    accessToken,
    "/me/mailFolders?$top=50&$filter=displayName eq '@Action'&$select=id,displayName",
  );
  const existing = lookup.value?.[0];
  if (existing?.id) return { folder: existing, created: false };
  const created = await graph(accessToken, "/me/mailFolders", "POST", { displayName: "@Action" });
  return { folder: created, created: true };
}

loadDotEnv();
const clientId = requireEnv("GRAPH_CLIENT_ID");
const tenantId = requireEnv("GRAPH_TENANT_ID");
const authority = `https://login.microsoftonline.com/${tenantId}`;
const cachePath = process.env.GTD_OUTLOOK_TOKEN_CACHE_PATH?.trim() || DEFAULT_CACHE_PATH;

const app = new PublicClientApplication({
  auth: { clientId, authority },
  cache: { cachePlugin: createFileCachePlugin(cachePath) },
});
const accounts = await app.getTokenCache().getAllAccounts();
const account = accounts[0];
if (!account) throw new Error("No account in cache. Run auth-cache spike first.");
const tokenResult = await app.acquireTokenSilent({ account, scopes: [GRAPH_SCOPE] });
const token = tokenResult?.accessToken;
if (!token) throw new Error("No access token.");

const action = await getOrCreateActionFolder(token);
const inboxList = await graph(
  token,
  "/me/mailFolders?$top=100&$filter=displayName eq 'Caixa de Entrada'&$select=id,displayName",
);
const inboxId = inboxList.value?.[0]?.id;
if (!inboxId) throw new Error("Inbox folder not found.");

const messages = await graph(
  token,
  `/me/mailFolders/${encodeURIComponent(inboxId)}/messages?$top=1&$select=id,subject,parentFolderId,receivedDateTime&$orderby=receivedDateTime desc`,
);
const message = messages.value?.[0];
if (!message?.id) throw new Error("No inbox message available.");

const moved = await graph(
  token,
  `/me/messages/${encodeURIComponent(message.id)}/move`,
  "POST",
  { destinationId: action.folder.id },
);
const patched = await graph(
  token,
  `/me/messages/${encodeURIComponent(moved.id)}?$select=id,categories,parentFolderId`,
  "PATCH",
  { categories: ["GTD: Action"] },
);
const verify = await graph(token, `/me/messages/${encodeURIComponent(moved.id)}?$select=id,categories,parentFolderId`);

console.log(
  JSON.stringify(
    {
      actionFolderId: action.folder.id,
      actionFolderCreated: action.created,
      sourceMessageId: message.id,
      movedMessageId: moved.id,
      movedParentFolderId: moved.parentFolderId ?? null,
      patchedCategories: patched.categories ?? [],
      verifiedParentFolderId: verify.parentFolderId ?? null,
      verifiedCategories: verify.categories ?? [],
      movedToAction: verify.parentFolderId === action.folder.id,
      categoryApplied: Array.isArray(verify.categories) && verify.categories.includes("GTD: Action"),
    },
    null,
    2,
  ),
);
