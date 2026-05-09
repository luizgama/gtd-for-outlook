import { PublicClientApplication, type IPublicClientApplication } from "@azure/msal-node";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
export const DEFAULT_AUTHORITY_HOST = "https://login.microsoftonline.com";
export const DEFAULT_TOKEN_CACHE_PATH = join(homedir(), ".gtd-outlook", "token-cache.json");

type FileOps = {
  chmodSync: typeof chmodSync;
  existsSync: typeof existsSync;
  mkdirSync: typeof mkdirSync;
  readFileSync: typeof readFileSync;
  writeFileSync: typeof writeFileSync;
};

const defaultFileOps: FileOps = {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
};

export type GraphAuthConfig = {
  clientId: string;
  tenantId: string;
  tokenCachePath?: string;
  authorityHost?: string;
};

export type DeviceCodePrompt = (message: string) => void;

export function resolveAuthority(tenantId: string, authorityHost = DEFAULT_AUTHORITY_HOST): string {
  return `${authorityHost.replace(/\/+$/, "")}/${tenantId}`;
}

export function ensurePrivateCacheFile(
  path: string,
  contents: string,
  ops: FileOps = defaultFileOps,
): void {
  ops.mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  ops.writeFileSync(path, contents, { mode: 0o600 });
  ops.chmodSync(path, 0o600);
}

export function createFileTokenCachePlugin(path: string, ops: FileOps = defaultFileOps) {
  return {
    async beforeCacheAccess(cacheContext: { tokenCache: { deserialize: (value: string) => void } }) {
      if (!ops.existsSync(path)) {
        return;
      }
      const cache = ops.readFileSync(path, "utf8");
      if (cache.trim()) {
        cacheContext.tokenCache.deserialize(cache);
      }
    },

    async afterCacheAccess(cacheContext: {
      cacheHasChanged: boolean;
      tokenCache: { serialize: () => string };
    }) {
      if (!cacheContext.cacheHasChanged) {
        return;
      }
      ensurePrivateCacheFile(path, cacheContext.tokenCache.serialize(), ops);
    },
  };
}

export function createMsalApp(config: GraphAuthConfig): IPublicClientApplication {
  const authority = resolveAuthority(config.tenantId, config.authorityHost);
  const tokenCachePath = config.tokenCachePath ?? DEFAULT_TOKEN_CACHE_PATH;

  return new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority,
    },
    cache: {
      cachePlugin: createFileTokenCachePlugin(tokenCachePath),
    },
  });
}

export async function acquireGraphAccessToken(
  app: IPublicClientApplication,
  onDeviceCode?: DeviceCodePrompt,
): Promise<{ accessToken: string; authMode: "silent" | "device-code" }> {
  const accounts = await app.getTokenCache().getAllAccounts();
  const account = accounts[0];

  if (account) {
    try {
      const result = await app.acquireTokenSilent({
        account,
        scopes: [GRAPH_SCOPE],
      });
      if (result?.accessToken) {
        return { accessToken: result.accessToken, authMode: "silent" };
      }
    } catch {
      // Fall back to device code below.
    }
  }

  const result = await app.acquireTokenByDeviceCode({
    scopes: [GRAPH_SCOPE],
    deviceCodeCallback: (response) => {
      onDeviceCode?.(response.message);
    },
  });

  if (!result?.accessToken) {
    throw new Error("MSAL did not return an access token.");
  }

  return { accessToken: result.accessToken, authMode: "device-code" };
}
