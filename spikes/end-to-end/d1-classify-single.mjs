import { PublicClientApplication } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

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

function sanitize(input) {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
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

async function acquireToken(app) {
  const accounts = await app.getTokenCache().getAllAccounts();
  const account = accounts[0];
  if (!account) throw new Error("No account in cache. Run auth-cache spike first.");
  const result = await app.acquireTokenSilent({ account, scopes: [GRAPH_SCOPE] });
  if (!result?.accessToken) throw new Error("No access token.");
  return result.accessToken;
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

const token = await acquireToken(app);
const listRes = await fetch(
  `${GRAPH_BASE}/me/messages?$top=1&$select=id,subject,bodyPreview,receivedDateTime&$orderby=receivedDateTime desc`,
  { headers: { Authorization: `Bearer ${token}` } },
);
if (!listRes.ok) throw new Error(`Message fetch failed: ${listRes.status}`);
const listPayload = await listRes.json();
const message = listPayload.value?.[0];
if (!message?.id) throw new Error("No message to classify.");

const sanitized = sanitize(`${message.subject ?? ""}\n${message.bodyPreview ?? ""}`);
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "confidence", "reason"],
  properties: {
    category: {
      type: "string",
      enum: [
        "@Action",
        "@WaitingFor",
        "@SomedayMaybe",
        "@Reference",
        "Action",
        "WaitingFor",
        "SomedayMaybe",
        "Reference",
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string", minLength: 1 },
  },
};

const prompt =
  "Classify this email into exactly one GTD category. Allowed category values: @Action, @WaitingFor, @SomedayMaybe, @Reference. Return only JSON with keys category, confidence, reason.";
const params = {
  name: "llm-task",
  agentId: "main",
  args: {
    prompt,
    input: { text: sanitized },
    schema,
    provider: "openai-codex",
    model: "gpt-5.5",
    timeoutMs: 60000,
  },
};

const raw = execFileSync(
  "openclaw",
  ["gateway", "call", "tools.invoke", "--json", "--timeout", "90000", "--params", JSON.stringify(params)],
  { encoding: "utf8" },
);
const toolResult = JSON.parse(raw);
let json = toolResult?.output?.details?.json;
if (!json) {
  const text = toolResult?.output?.content?.[0]?.text;
  if (typeof text === "string") {
    try {
      json = JSON.parse(text);
    } catch {
      // keep null and fail below
    }
  }
}
if (!json || typeof json !== "object") {
  throw new Error(`llm-task returned no JSON payload. Raw output: ${raw}`);
}
const normalizedCategory = {
  Action: "@Action",
  WaitingFor: "@WaitingFor",
  SomedayMaybe: "@SomedayMaybe",
  Reference: "@Reference",
}[json.category] ?? json.category;

console.log(
  JSON.stringify(
    {
      messageId: message.id,
      subject: message.subject ?? null,
      receivedDateTime: message.receivedDateTime ?? null,
      classification: { ...json, category: normalizedCategory },
    },
    null,
    2,
  ),
);
