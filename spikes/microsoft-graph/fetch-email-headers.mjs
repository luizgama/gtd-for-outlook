import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
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
      // Read-only spike script: no cache writes needed for B7.
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

async function graphGet(accessToken, pathWithQuery) {
  const response = await fetch(`${GRAPH_BASE}${pathWithQuery}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph request failed (${response.status} ${response.statusText}): ${text}`);
  }

  return response.json();
}

function findHeader(headers, name) {
  const normalized = name.toLowerCase();
  return headers.find((header) => String(header.name ?? "").toLowerCase() === normalized) ?? null;
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

console.log("Starting Microsoft Graph B7 fetch-email-headers validation.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);
console.log(`Cache path: ${cachePath}`);

const accessToken = await acquireTokenSilent(app);
const listPayload = await graphGet(
  accessToken,
  "/me/messages?$top=10&$select=id,subject,sender,receivedDateTime&$orderby=receivedDateTime desc",
);
const messages = Array.isArray(listPayload.value) ? listPayload.value : [];
if (messages.length === 0) {
  throw new Error("No messages returned. Cannot validate B7 without at least one message.");
}

const headerSummaries = [];
for (const message of messages) {
  const id = message.id;
  if (!id) {
    continue;
  }

  const encodedId = encodeURIComponent(id);
  const detail = await graphGet(
    accessToken,
    `/me/messages/${encodedId}?$select=id,subject,sender,internetMessageHeaders`,
  );
  const headers = Array.isArray(detail.internetMessageHeaders)
    ? detail.internetMessageHeaders
    : [];
  const listUnsubscribe = findHeader(headers, "List-Unsubscribe");

  headerSummaries.push({
    id: detail.id ?? null,
    subject: detail.subject ?? null,
    sender: detail.sender?.emailAddress?.address ?? null,
    headerCount: headers.length,
    hasListUnsubscribe: Boolean(listUnsubscribe),
    listUnsubscribeValuePreview: listUnsubscribe
      ? String(listUnsubscribe.value ?? "").slice(0, 160)
      : null,
  });
}

const listUnsubscribeCount = headerSummaries.filter((item) => item.hasListUnsubscribe).length;
const averageHeaderCount =
  headerSummaries.length === 0
    ? 0
    : Math.round(
        headerSummaries.reduce((sum, item) => sum + item.headerCount, 0) /
          headerSummaries.length,
      );

console.log(
  JSON.stringify(
    {
      sampledMessages: headerSummaries.length,
      listUnsubscribeCount,
      averageHeaderCount,
      messages: headerSummaries,
    },
    null,
    2,
  ),
);

console.log("B7 implementation complete. Validate output and record findings in docs/spikes/microsoft-graph.md.");
