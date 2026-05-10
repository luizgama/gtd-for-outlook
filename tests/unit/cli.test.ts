import { describe, expect, it } from "vitest";
import { createCli } from "../../src/cli";

describe("cli", () => {
  it("parses process command flags and emits payload", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const cli = createCli({
      loadSettings: () => ({
        graphClientId: "id",
        graphTenantId: "tenant",
        batchSize: 50,
        maxEmailsPerRun: 200,
        maxLlmCallsPerRun: 500,
        lookbackDays: 7,
        appHomeDir: "/tmp/.gtd-outlook",
        stateFilePath: "/tmp/.gtd-outlook/state.json",
        classificationCachePath: "/tmp/.gtd-outlook/classification-cache.sqlite",
        autoApproveHighImportance: false,
      }),
      runSchedulerCommand: () => ({ ok: true, output: "", error: "", status: 0 }),
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
    });

    await cli.parseAsync([
      "node",
      "gtd-outlook",
      "process",
      "--batch-size",
      "10",
      "--max-emails",
      "22",
      "--max-llm-calls",
      "30",
      "--since",
      "2026-05-01",
      "--backlog",
    ]);

    expect(err).toEqual([]);
    expect(out[0]).toContain('"command": "process"');
    expect(out[0]).toContain('"batchSize": 50');
    expect(out[0]).toContain('"maxEmails": 22');
  });

  it("prints actionable error when scheduler status is unavailable", async () => {
    const out: string[] = [];
    const err: string[] = [];
    let call = 0;
    const cli = createCli({
      loadSettings: () => ({
        graphClientId: "id",
        graphTenantId: "tenant",
        batchSize: 50,
        maxEmailsPerRun: 200,
        maxLlmCallsPerRun: 500,
        lookbackDays: 7,
        appHomeDir: "/tmp/.gtd-outlook",
        stateFilePath: "/tmp/.gtd-outlook/state.json",
        classificationCachePath: "/tmp/.gtd-outlook/classification-cache.sqlite",
        autoApproveHighImportance: false,
      }),
      runSchedulerCommand: () => {
        call += 1;
        if (call === 1) {
          return { ok: true, output: "healthy", error: "", status: 0 };
        }
        return { ok: false, output: "", error: "not supported", status: 1 };
      },
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
    });

    await cli.parseAsync(["node", "gtd-outlook", "status"]);

    expect(out).toEqual([]);
    expect(err[0]).toContain("cron status is unavailable");
  });

  it("requires --every for schedule command", async () => {
    const cli = createCli({
      loadSettings: () => ({
        graphClientId: "id",
        graphTenantId: "tenant",
        batchSize: 50,
        maxEmailsPerRun: 200,
        maxLlmCallsPerRun: 500,
        lookbackDays: 7,
        appHomeDir: "/tmp/.gtd-outlook",
        stateFilePath: "/tmp/.gtd-outlook/state.json",
        classificationCachePath: "/tmp/.gtd-outlook/classification-cache.sqlite",
        autoApproveHighImportance: false,
      }),
      runSchedulerCommand: () => ({ ok: true, output: "ok", error: "", status: 0 }),
      stdout: () => {},
      stderr: () => {},
    });

    await expect(cli.parseAsync(["node", "gtd-outlook", "schedule"])).rejects.toThrow(
      "required option '--every <interval>' not specified",
    );
  });

  it("prints actionable error when gateway binary/runtime is missing", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const cli = createCli({
      loadSettings: () => ({
        graphClientId: "id",
        graphTenantId: "tenant",
        batchSize: 50,
        maxEmailsPerRun: 200,
        maxLlmCallsPerRun: 500,
        lookbackDays: 7,
        appHomeDir: "/tmp/.gtd-outlook",
        stateFilePath: "/tmp/.gtd-outlook/state.json",
        classificationCachePath: "/tmp/.gtd-outlook/classification-cache.sqlite",
        autoApproveHighImportance: false,
      }),
      runSchedulerCommand: () => ({ ok: false, output: "", error: "spawn openclaw ENOENT", status: null }),
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
    });

    await cli.parseAsync(["node", "gtd-outlook", "status"]);

    expect(out).toEqual([]);
    expect(err[0]).toContain("Ensure OpenClaw is installed and running");
    expect(err[0]).toContain("ENOENT");
  });
});
