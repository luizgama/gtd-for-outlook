import { describe, expect, it } from "vitest";
import { createCli, type CliDependencies } from "../../src/cli";

function baseDependencies(overrides: Partial<CliDependencies> = {}): Partial<CliDependencies> {
  return {
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
    runAgentCommand: () => ({ ok: true, output: "agent-ok", error: "", status: 0 }),
    prompt: async () => ({ clientId: "x", tenantId: "y" }),
    cacheExists: () => false,
    cacheSizeBytes: () => 0,
    clearCacheFile: () => {},
    writeSetup: () => "/tmp/.gtd-outlook/config.json",
    stdout: () => {},
    stderr: () => {},
    ...overrides,
  };
}

describe("cli", () => {
  it("parses process command flags and emits payload", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const cli = createCli(
      baseDependencies({
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
      }),
    );

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

  it("routes process through agent runtime when --agent is passed", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const cli = createCli(
      baseDependencies({
        runAgentCommand: () => ({ ok: true, output: "{\"via\":\"agent\"}", error: "", status: 0 }),
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
      }),
    );

    await cli.parseAsync(["node", "gtd-outlook", "process", "--agent"]);
    expect(err).toEqual([]);
    expect(out[0]).toContain('"via":"agent"');
  });

  it("prints actionable error when scheduler status is unavailable", async () => {
    const out: string[] = [];
    const err: string[] = [];
    let call = 0;
    const cli = createCli(
      baseDependencies({
        runSchedulerCommand: () => {
          call += 1;
          if (call === 1) {
            return { ok: true, output: "healthy", error: "", status: 0 };
          }
          return { ok: false, output: "", error: "not supported", status: 1 };
        },
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
      }),
    );

    await cli.parseAsync(["node", "gtd-outlook", "status"]);
    expect(out).toEqual([]);
    expect(err[0]).toContain("cron status is unavailable");
  });

  it("requires --every for schedule command", async () => {
    const cli = createCli(baseDependencies());
    await expect(cli.parseAsync(["node", "gtd-outlook", "schedule"])).rejects.toThrow(
      "required option '--every <interval>' not specified",
    );
  });

  it("prints actionable error when gateway binary/runtime is missing", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const cli = createCli(
      baseDependencies({
        runSchedulerCommand: () => ({ ok: false, output: "", error: "spawn openclaw ENOENT", status: null }),
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
      }),
    );

    await cli.parseAsync(["node", "gtd-outlook", "status"]);
    expect(out).toEqual([]);
    expect(err[0]).toContain("Ensure OpenClaw is installed and running");
    expect(err[0]).toContain("ENOENT");
  });

  it("shows cache stats and clears cache", async () => {
    const out: string[] = [];
    const cli = createCli(
      baseDependencies({
        cacheExists: () => true,
        cacheSizeBytes: () => 2048,
        stdout: (line) => out.push(line),
      }),
    );

    await cli.parseAsync(["node", "gtd-outlook", "cache", "stats"]);
    await cli.parseAsync(["node", "gtd-outlook", "cache", "clear"]);
    expect(out[0]).toContain('"exists": true');
    expect(out[0]).toContain('"sizeBytes": 2048');
    expect(out[1]).toContain('"cleared": true');
  });

  it("runs cache stats without Graph credentials by falling back to default cache path", async () => {
    const out: string[] = [];
    const cli = createCli(
      baseDependencies({
        loadSettings: () => {
          throw new Error("Missing required Graph setting: GRAPH_CLIENT_ID.");
        },
        cacheExists: () => false,
        stdout: (line) => out.push(line),
      }),
    );

    await cli.parseAsync(["node", "gtd-outlook", "cache", "stats"]);
    expect(out[0]).toContain('"exists": false');
    expect(out[0]).toContain(".gtd-outlook/classification-cache.sqlite");
  });

  it("runs setup using prompt when flags are missing", async () => {
    const out: string[] = [];
    let wrote = "";
    const cli = createCli(
      baseDependencies({
        prompt: async () => ({ clientId: "cli-id", tenantId: "tenant-id" }),
        writeSetup: (input) => {
          wrote = `${input.graphClientId}:${input.graphTenantId}`;
          return "/tmp/.gtd-outlook/config.json";
        },
        stdout: (line) => out.push(line),
      }),
    );

    await cli.parseAsync(["node", "gtd-outlook", "setup"]);
    expect(wrote).toBe("cli-id:tenant-id");
    expect(out[0]).toContain("Saved Graph credentials");
  });
});
