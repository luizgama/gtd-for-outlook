import { Command } from "commander";
import inquirer from "inquirer";

function parseNonInteractiveInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.clientId && parsed?.tenantId) {
      return {
        clientId: String(parsed.clientId),
        tenantId: String(parsed.tenantId),
        confirm: parsed.confirm !== false,
      };
    }
  } catch {
    // Fall through to KEY=VALUE parser
  }

  const map = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) map[key] = value;
  }

  if (!map.clientId || !map.tenantId) {
    return null;
  }

  return {
    clientId: map.clientId,
    tenantId: map.tenantId,
    confirm: map.confirm !== "false",
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

const program = new Command();
program
  .name("c5-commander-inquirer")
  .option("--client-id <clientId>")
  .option("--tenant-id <tenantId>")
  .option("--confirm", "confirm setup")
  .option("--non-interactive", "force non-interactive stdin mode");

program.parse(process.argv);
const opts = program.opts();

let mode = "interactive";
let values = null;

if (opts.nonInteractive || !process.stdin.isTTY) {
  mode = "non-interactive";
  const raw = await readStdin();
  const parsed = parseNonInteractiveInput(raw);
  if (parsed) {
    values = parsed;
  } else if (opts.clientId && opts.tenantId) {
    values = {
      clientId: opts.clientId,
      tenantId: opts.tenantId,
      confirm: Boolean(opts.confirm),
    };
  } else {
    throw new Error("Non-interactive mode requires stdin payload or --client-id and --tenant-id.");
  }
} else if (opts.clientId && opts.tenantId) {
  values = {
    clientId: opts.clientId,
    tenantId: opts.tenantId,
    confirm: Boolean(opts.confirm),
  };
} else {
  const answers = await inquirer.prompt([
    { type: "input", name: "clientId", message: "Client ID:" },
    { type: "input", name: "tenantId", message: "Tenant ID:" },
    { type: "confirm", name: "confirm", message: "Confirm setup?", default: true },
  ]);
  values = answers;
}

const valid = Boolean(values?.clientId && values?.tenantId && values?.confirm !== false);
console.log(
  JSON.stringify(
    {
      mode,
      clientIdPresent: Boolean(values?.clientId),
      tenantIdPresent: Boolean(values?.tenantId),
      confirmed: Boolean(values?.confirm),
      valid,
    },
    null,
    2,
  ),
);

if (!valid) {
  throw new Error("C5 setup flow did not produce valid values.");
}
