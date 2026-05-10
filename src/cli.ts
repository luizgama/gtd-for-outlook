import { spawnSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import { DEFAULT_CLASSIFICATION_CACHE_PATH } from "./config/constants.js";
import { loadAppSettings, type AppSettings, writeSetupConfig } from "./config/settings.js";
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
  runAgentCommand: (message: string) => SchedulerCommandResult;
  prompt: (questions: Array<{ type: string; name: string; message: string; default?: string }>) => Promise<Record<string, string>>;
  cacheExists: (path: string) => boolean;
  cacheSizeBytes: (path: string) => number;
  clearCacheFile: (path: string) => void;
  writeSetup: (input: { graphClientId: string; graphTenantId: string }) => string;
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

function defaultRunAgentCommand(message: string): SchedulerCommandResult {
  const result = spawnSync("openclaw", ["agent", "--message", message, "--json"], { encoding: "utf8" });
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

function invokeAgentStage(
  stageName: string,
  message: string,
  deps: CliDependencies,
): void {
  const result = deps.runAgentCommand(message);
  if (!result.ok) {
    deps.stderr(
      `Unable to invoke OpenClaw ${stageName} stage. Details: ${result.error || result.output || "no output"}`,
    );
    return;
  }
  deps.stdout(result.output);
}

function resolveCachePath(deps: CliDependencies): string {
  try {
    return deps.loadSettings().classificationCachePath || DEFAULT_CLASSIFICATION_CACHE_PATH;
  } catch {
    const envPath = process.env.GTD_CLASSIFICATION_CACHE_PATH?.trim();
    return envPath || DEFAULT_CLASSIFICATION_CACHE_PATH;
  }
}

async function defaultPrompt(
  questions: Array<{ type: string; name: string; message: string; default?: string }>,
): Promise<Record<string, string>> {
  const rl = createInterface({ input, output });
  const answers: Record<string, string> = {};
  try {
    for (const question of questions) {
      const suffix = question.default ? ` [${question.default}]` : "";
      const response = (await rl.question(`${question.message}${suffix}: `)).trim();
      answers[question.name] = response || question.default || "";
    }
    return answers;
  } finally {
    rl.close();
  }
}

export function createCli(dependencies?: Partial<CliDependencies>): Command {
  const deps: CliDependencies = {
    loadSettings: dependencies?.loadSettings ?? (() => loadAppSettings()),
    runSchedulerCommand: dependencies?.runSchedulerCommand ?? defaultRunSchedulerCommand,
    runAgentCommand: dependencies?.runAgentCommand ?? defaultRunAgentCommand,
    prompt: dependencies?.prompt ?? ((questions) => defaultPrompt(questions)),
    cacheExists: dependencies?.cacheExists ?? ((path) => existsSync(path)),
    cacheSizeBytes: dependencies?.cacheSizeBytes ?? ((path) => statSync(path).size),
    clearCacheFile: dependencies?.clearCacheFile ?? ((path) => rmSync(path, { force: true })),
    writeSetup: dependencies?.writeSetup ?? ((input) => writeSetupConfig(input)),
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
    .command("setup")
    .description("Interactive setup for Azure Graph credentials")
    .option("--client-id <id>", "Azure Graph client/application id")
    .option("--tenant-id <id>", "Azure tenant id")
    .action(async (options: { clientId?: string; tenantId?: string }) => {
      let clientId = options.clientId?.trim();
      let tenantId = options.tenantId?.trim();

      if (!clientId || !tenantId) {
        const answers = await deps.prompt([
          {
            type: "input",
            name: "clientId",
            message: "Azure Graph client id",
            default: clientId ?? "",
          },
          {
            type: "input",
            name: "tenantId",
            message: "Azure tenant id",
            default: tenantId ?? "",
          },
        ]);
        clientId = (answers.clientId ?? "").trim();
        tenantId = (answers.tenantId ?? "").trim();
      }

      if (!clientId || !tenantId) {
        deps.stderr("Setup aborted: both client id and tenant id are required.");
        return;
      }

      const path = deps.writeSetup({
        graphClientId: clientId,
        graphTenantId: tenantId,
      });
      deps.stdout(`Saved Graph credentials to ${path}`);
    });

  program
    .command("process")
    .description("Run the full GTD processing flow")
    .option("--batch-size <n>", "batch size", (v) => Number.parseInt(v, 10))
    .option("--max-emails <n>", "max emails to process", (v) => Number.parseInt(v, 10))
    .option("--max-llm-calls <n>", "max llm calls", (v) => Number.parseInt(v, 10))
    .option("--since <value>", "filter emails since an ISO date or relative period")
    .option("--backlog", "enable first-time backlog mode", false)
    .option("--agent", "invoke process path through OpenClaw agent runtime", false)
    .action((options: Record<string, unknown> & { agent?: boolean }) => {
      const settings = deps.loadSettings();
      if (options.agent) {
        const message = `Run GTD process with options: ${JSON.stringify(options)}`;
        const result = deps.runAgentCommand(message);
        if (!result.ok) {
          deps.stderr(
            `Unable to invoke OpenClaw agent runtime for process command. Details: ${result.error || result.output || "no output"}`,
          );
          return;
        }
        deps.stdout(result.output);
        return;
      }
      deps.stdout(formatProcessPayload(settings, options as Record<string, unknown>));
    });

  program
    .command("capture")
    .description("Fetch unread emails")
    .action(() => {
      deps.loadSettings();
      invokeAgentStage("capture", "Run GTD capture stage.", deps);
    });

  program
    .command("clarify")
    .description("Classify fetched emails")
    .action(() => {
      deps.loadSettings();
      invokeAgentStage("clarify", "Run GTD clarify stage.", deps);
    });

  program
    .command("organize")
    .description("Move/categorize classified emails")
    .action(() => {
      deps.loadSettings();
      invokeAgentStage("organize", "Run GTD organize stage.", deps);
    });

  const cache = new Command("cache").description("Inspect or clear local classification cache");
  cache
    .command("stats")
    .description("Show local cache file metrics")
    .action(() => {
      const path = resolveCachePath(deps);
      if (!deps.cacheExists(path)) {
        deps.stdout(JSON.stringify({ cachePath: path, exists: false, sizeBytes: 0 }, null, 2));
        return;
      }
      deps.stdout(JSON.stringify({ cachePath: path, exists: true, sizeBytes: deps.cacheSizeBytes(path) }, null, 2));
    });

  cache
    .command("clear")
    .description("Delete local cache file")
    .action(() => {
      const path = resolveCachePath(deps);
      deps.clearCacheFile(path);
      deps.stdout(JSON.stringify({ cachePath: path, cleared: true }, null, 2));
    });
  program.addCommand(cache);

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
