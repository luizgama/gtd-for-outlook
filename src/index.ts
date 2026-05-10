import { pathToFileURL } from "node:url";
import { CommanderError } from "commander";
import { createCli } from "./cli.js";

export async function runCli(argv = process.argv): Promise<void> {
  const cli = createCli();
  await cli.parseAsync(argv);
}

const currentModuleUrl = import.meta.url;
const entryArg = process.argv[1];
const entryUrl = entryArg ? pathToFileURL(entryArg).href : "";

if (entryUrl === currentModuleUrl) {
  runCli().catch((error) => {
    if (error instanceof CommanderError && (error.code === "commander.helpDisplayed" || error.code === "commander.version")) {
      process.exitCode = 0;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
