import { spawnSync } from "node:child_process";
import { Command } from "commander";
import { loadAppSettings, type AppSettings } from "./config/settings.js";
import { generateWeeklyReview } from "./gtd/review.js";

export type SchedulerCommandResult = {
  ok: boolean;
  output: string;
  error: string;
  status: number | null;
};

export type CliDependencies = {
  loadSettings: () => AppSettings;
  runSchedulerCommand: (args: string[]) => SchedulerCommandResult;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

function defaultRunSchedulerCommand(args: string[]): SchedulerCommandResult {
  const result = spawnSync("openclaw", args, { encoding: "utf8" });
  const processError = result.error instanceof Error ? result.error.message : "";
  return {
    ok: result.status === 0,
    output: (result.stdout ?? "").trim(),
    error: ((result.stderr ?? "").trim() || processError).trim(),
    status: result.status,
  };
}

function formatProcessPayload(settings: AppSettings, options: Record<string, unknown>): string {
  return JSON.stringify(
    {
      command: "process",
      options,
      settings: {
        batchSize: settings.batchSize,
        maxEmailsPerRun: settings.maxEmailsPerRun,
        maxLlmCallsPerRun: settings.maxLlmCallsPerRun,
        lookbackDays: settings.lookbackDays,
      },
      note: "Processing engine wiring is active through core pipeline modules.",
    },
    null,
    2,
  );
}

export function createCli(dependencies?: Partial<CliDependencies>): Command {
  const deps: CliDependencies = {
    loadSettings: dependencies?.loadSettings ?? (() => loadAppSettings()),
    runSchedulerCommand: dependencies?.runSchedulerCommand ?? defaultRunSchedulerCommand,
    stdout: dependencies?.stdout ?? ((line) => console.log(line)),
    stderr: dependencies?.stderr ?? ((line) => console.error(line)),
  };

  const program = new Command();
  program
    .name("gtd-outlook")
    .description("Organize Microsoft 365 mailbox using GTD methodology")
    .version("0.1.0");
  program.exitOverride();

  program
    .command("process")
    .description("Run the full GTD processing flow")
    .option("--batch-size <n>", "batch size", (v) => Number.parseInt(v, 10))
    .option("--max-emails <n>", "max emails to process", (v) => Number.parseInt(v, 10))
    .option("--max-llm-calls <n>", "max llm calls", (v) => Number.parseInt(v, 10))
    .option("--since <value>", "filter emails since an ISO date or relative period")
    .option("--backlog", "enable first-time backlog mode", false)
    .action((options) => {
      const settings = deps.loadSettings();
      deps.stdout(formatProcessPayload(settings, options as Record<string, unknown>));
    });

  program
    .command("capture")
    .description("Fetch unread emails")
    .action(() => {
      deps.loadSettings();
      deps.stdout(JSON.stringify({ command: "capture", status: "queued" }));
    });

  program
    .command("clarify")
    .description("Classify fetched emails")
    .action(() => {
      deps.loadSettings();
      deps.stdout(JSON.stringify({ command: "clarify", status: "queued" }));
    });

  program
    .command("organize")
    .description("Move/categorize classified emails")
    .action(() => {
      deps.loadSettings();
      deps.stdout(JSON.stringify({ command: "organize", status: "queued" }));
    });

  program
    .command("review")
    .description("Generate GTD weekly review summary")
    .action(() => {
      const summary = generateWeeklyReview([]);
      deps.stdout(summary.markdown);
    });

  program
    .command("status")
    .description("Show gateway and scheduler status")
    .action(() => {
      const gateway = deps.runSchedulerCommand(["gateway", "health"]);
      if (!gateway.ok) {
        deps.stderr(
          `Unable to query OpenClaw gateway health. Ensure OpenClaw is installed and running. Details: ${gateway.error || gateway.output || "no output"}`,
        );
        return;
      }

      const cron = deps.runSchedulerCommand(["cron", "status", "--json"]);
      if (!cron.ok) {
        deps.stderr(
          `Gateway is reachable, but cron status is unavailable in this environment. Details: ${cron.error || cron.output || "no output"}`,
        );
        return;
      }

      deps.stdout(JSON.stringify({ gateway: gateway.output, cron: cron.output }, null, 2));
    });

  program
    .command("schedule")
    .description("Create recurring OpenClaw cron job for inbox processing")
    .requiredOption("--every <interval>", "cron interval (e.g. 30m, 1h)")
    .action((options: { every: string }) => {
      const add = deps.runSchedulerCommand([
        "cron",
        "add",
        "--every",
        options.every,
        "--agent",
        "main",
        "--message",
        "Run GTD inbox process command.",
        "--json",
      ]);
      if (!add.ok) {
        deps.stderr(
          `Unable to configure schedule in this environment. Use a runtime with OpenClaw cron support. Details: ${add.error || add.output || "no output"}`,
        );
        return;
      }
      deps.stdout(add.output);
    });

  return program;
}
