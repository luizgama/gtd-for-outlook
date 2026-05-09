import { PublicClientApplication, LogLevel } from "@azure/msal-node";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const DEFAULT_ENV_PATH = ".env";

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

loadDotEnv();

const clientId = requireEnv("GRAPH_CLIENT_ID");
const tenantId = requireEnv("GRAPH_TENANT_ID");
const authority = `https://login.microsoftonline.com/${tenantId}`;

const app = new PublicClientApplication({
  auth: {
    clientId,
    authority,
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

console.log("Starting Microsoft Graph device code flow.");
console.log(`Client ID: ${redact(clientId)}`);
console.log(`Tenant: ${tenantId}`);
console.log(`Scope: ${GRAPH_SCOPE}`);

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

if (!result?.accessToken) {
  throw new Error("MSAL did not return an access token.");
}

console.log("Device code authentication succeeded.");
console.log(
  JSON.stringify(
    {
      accountUsername: result.account?.username ?? null,
      tenantId: result.tenantId ?? null,
      scopes: result.scopes ?? [],
      expiresOn: result.expiresOn?.toISOString() ?? null,
      accessTokenReturned: true,
      accessTokenLength: result.accessToken.length,
      idTokenReturned: Boolean(result.idToken),
    },
    null,
    2,
  ),
);

if (!result.scopes?.includes(GRAPH_SCOPE)) {
  throw new Error(`Expected granted scope ${GRAPH_SCOPE}.`);
}

console.log("B2 acceptance passed: device code flow returned a Mail.ReadWrite token.");
