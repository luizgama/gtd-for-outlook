import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0/me/messages";
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
      // Read-only spike script: no cache writes needed for B5.
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

  return result;
}

function toMessageSummary(message) {
  return {
    id: message.id ?? null,
    subject: message.subject ?? null,
    sender: message.sender?.emailAddress?.address ?? null,
    senderName: message.sender?.emailAddress?.name ?? null,
    bodyPreview: message.bodyPreview ?? null,
    bodyPreviewLength: typeof message.bodyPreview === "string" ? message.bodyPreview.length : 0,
    receivedDateTime: message.receivedDateTime ?? null,
    isRead: message.isRead ?? null,
    hasAttachments: message.hasAttachments ?? null,
  };
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

console.log("Starting Microsoft Graph B5 fetch-emails validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const tokenResult = await acquireTokenSilent(app);
const query = new URLSearchParams({
  "$top": "10",
  "$select": "id,subject,sender,bodyPreview,receivedDateTime,isRead,hasAttachments",
  "$orderby": "receivedDateTime desc",
});

const response = await fetch(`${GRAPH_ENDPOINT}?${query.toString()}`, {
  headers: {
    Authorization: `Bearer ${tokenResult.accessToken}`,
  },
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Graph request failed (${response.status} ${response.statusText}): ${text}`);
}

const payload = await response.json();
const messages = Array.isArray(payload.value) ? payload.value : [];
const summaries = messages.map(toMessageSummary);
const maxBodyPreviewLength = summaries.reduce(
  (max, item) => Math.max(max, item.bodyPreviewLength),
  0,
);
const htmlLikeBodyPreviewCount = summaries.filter((item) =>
  typeof item.bodyPreview === "string" && /<[^>]+>/.test(item.bodyPreview),
).length;

console.log(
  JSON.stringify(
    {
      messageCount: summaries.length,
      maxBodyPreviewLength,
      bodyPreviewLooksPlainText: htmlLikeBodyPreviewCount === 0,
      htmlLikeBodyPreviewCount,
      hasNextLink: typeof payload["@odata.nextLink"] === "string",
      messages: summaries,
    },
    null,
    2,
  ),
);

console.log("B5 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
