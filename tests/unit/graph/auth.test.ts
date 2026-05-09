import { describe, expect, it, vi } from "vitest";
import {
  createFileTokenCachePlugin,
  ensurePrivateCacheFile,
  resolveAuthority,
} from "../../../src/graph/auth";

describe("graph/auth", () => {
  it("builds authority from host and tenant", () => {
    expect(resolveAuthority("tenant-1")).toBe("https://login.microsoftonline.com/tenant-1");
    expect(resolveAuthority("tenant-2", "https://example.com/")).toBe("https://example.com/tenant-2");
  });

  it("writes private cache file with secure mode", () => {
    const ops = {
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      chmodSync: vi.fn(),
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
    };

    ensurePrivateCacheFile("/tmp/cache.json", "{}", ops as never);

    expect(ops.mkdirSync).toHaveBeenCalledWith("/tmp", { recursive: true, mode: 0o700 });
    expect(ops.writeFileSync).toHaveBeenCalledWith("/tmp/cache.json", "{}", { mode: 0o600 });
    expect(ops.chmodSync).toHaveBeenCalledWith("/tmp/cache.json", 0o600);
  });

  it("loads and saves cache through plugin hooks", async () => {
    const deserialize = vi.fn();
    const serialize = vi.fn(() => '{"cached":true}');
    const ops = {
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      chmodSync: vi.fn(),
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => '{"token":"abc"}'),
    };

    const plugin = createFileTokenCachePlugin("/tmp/cache.json", ops as never);

    await plugin.beforeCacheAccess({
      tokenCache: { deserialize },
    });
    expect(deserialize).toHaveBeenCalledWith('{"token":"abc"}');

    await plugin.afterCacheAccess({
      cacheHasChanged: true,
      tokenCache: { serialize },
    });
    expect(serialize).toHaveBeenCalled();
    expect(ops.writeFileSync).toHaveBeenCalled();
    expect(ops.chmodSync).toHaveBeenCalledWith("/tmp/cache.json", 0o600);
  });
});
