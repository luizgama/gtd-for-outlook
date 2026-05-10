import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_MAX_EMAILS_PER_RUN,
  DEFAULT_MAX_LLM_CALLS_PER_RUN,
} from "../../../src/config/constants";
import { loadAppSettings, writeSetupConfig } from "../../../src/config/settings";

describe("config/settings", () => {
  it("loads required graph credentials from env with defaults", () => {
    const settings = loadAppSettings({
      env: {
        GRAPH_CLIENT_ID: "client-id",
        GRAPH_TENANT_ID: "tenant-id",
      },
    });

    expect(settings.graphClientId).toBe("client-id");
    expect(settings.graphTenantId).toBe("tenant-id");
    expect(settings.batchSize).toBe(DEFAULT_BATCH_SIZE);
    expect(settings.maxEmailsPerRun).toBe(DEFAULT_MAX_EMAILS_PER_RUN);
    expect(settings.maxLlmCallsPerRun).toBe(DEFAULT_MAX_LLM_CALLS_PER_RUN);
    expect(settings.lookbackDays).toBe(DEFAULT_LOOKBACK_DAYS);
    expect(settings.autoApproveHighImportance).toBe(false);
  });

  it("merges local config and allows env overrides", () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-config-"));
    const path = join(dir, "config.json");
    writeFileSync(
      path,
      JSON.stringify({
        graphClientId: "file-client",
        graphTenantId: "file-tenant",
        batchSize: 20,
        maxEmailsPerRun: 33,
        autoApproveHighImportance: true,
      }),
    );

    const settings = loadAppSettings({
      configPath: path,
      env: {
        GRAPH_CLIENT_ID: "env-client",
        GTD_MAX_EMAILS_PER_RUN: "99",
      },
    });

    expect(settings.graphClientId).toBe("env-client");
    expect(settings.graphTenantId).toBe("file-tenant");
    expect(settings.batchSize).toBe(20);
    expect(settings.maxEmailsPerRun).toBe(99);
    expect(settings.autoApproveHighImportance).toBe(true);
  });

  it("fails early when required graph credentials are missing", () => {
    expect(() => loadAppSettings({ env: {} })).toThrow("Missing required Graph setting: GRAPH_CLIENT_ID.");
  });

  it("fails on invalid config json", () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-config-"));
    const path = join(dir, "config.json");
    writeFileSync(path, "{bad-json");

    expect(() =>
      loadAppSettings({
        configPath: path,
        env: {
          GRAPH_CLIENT_ID: "x",
          GRAPH_TENANT_ID: "y",
        },
      }),
    ).toThrow("Invalid config JSON");
  });

  it("writes setup config with Graph credentials", () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-config-"));
    const path = join(dir, "config.json");
    const writtenPath = writeSetupConfig(
      {
        graphClientId: "abc",
        graphTenantId: "def",
      },
      { configPath: path },
    );
    expect(writtenPath).toBe(path);
    const loaded = loadAppSettings({ configPath: path, env: {} });
    expect(loaded.graphClientId).toBe("abc");
    expect(loaded.graphTenantId).toBe("def");
  });
});
