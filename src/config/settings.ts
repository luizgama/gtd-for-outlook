import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";;
import {
  APP_HOME_DIR,
  DEFAULT_AUTO_APPROVE_HIGH_IMPORTANCE,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CLASSIFICATION_CACHE_PATH,
  DEFAULT_CONFIG_PATH,
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_MAX_EMAILS_PER_RUN,
  DEFAULT_MAX_LLM_CALLS_PER_RUN,
  DEFAULT_STATE_PATH,
} from "./constants.js";

type FsOps = {
  chmodSync: typeof chmodSync;
  existsSync: typeof existsSync;
  mkdirSync: typeof mkdirSync;
  readFileSync: typeof readFileSync;
  writeFileSync: typeof writeFileSync;
};

const defaultFsOps: FsOps = {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
};

export interface AppSettings {
  graphClientId: string;
  graphTenantId: string;
  batchSize: number;
  maxEmailsPerRun: number;
  maxLlmCallsPerRun: number;
  lookbackDays: number;
  appHomeDir: string;
  stateFilePath: string;
  classificationCachePath: string;
  autoApproveHighImportance: boolean;
  logGraphApiToFile: boolean;
  logGraphApiFilePath?: string;
}

export interface SetupConfigInput {
  graphClientId: string;
  graphTenantId: string;
}

type PartialConfig = Partial<AppSettings> & {
  graphClientId?: string;
  graphTenantId?: string;
  logGraphApiToFile?: boolean;
  logGraphApiFilePath?: string;
};

type EnvSource = NodeJS.ProcessEnv;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
}

function readLocalConfig(path: string, ops: FsOps): PartialConfig {
  if (!ops.existsSync(path)) {
    return {};
  }
  const raw = ops.readFileSync(path, "utf8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as PartialConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid config JSON at ${path}: ${message}`);
  }
}

function requireGraphCredentials(settings: PartialConfig): Pick<AppSettings, "graphClientId" | "graphTenantId"> {
  const graphClientId = settings.graphClientId?.trim();
  const graphTenantId = settings.graphTenantId?.trim();

  if (!graphClientId) {
    throw new Error("Missing required Graph setting: GRAPH_CLIENT_ID.");
  }
  if (!graphTenantId) {
    throw new Error("Missing required Graph setting: GRAPH_TENANT_ID.");
  }

  return { graphClientId, graphTenantId };
}

export function loadAppSettings(
  options: {
    env?: EnvSource;
    configPath?: string;
    fsOps?: FsOps;
  } = {},
): AppSettings {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const fsOps = options.fsOps ?? defaultFsOps;
  const fileConfig = readLocalConfig(configPath, fsOps);

  const merged: PartialConfig = {
    ...fileConfig,
    graphClientId: env.GRAPH_CLIENT_ID ?? fileConfig.graphClientId,
    graphTenantId: env.GRAPH_TENANT_ID ?? fileConfig.graphTenantId,
    batchSize: parsePositiveInt(env.GTD_BATCH_SIZE, fileConfig.batchSize ?? DEFAULT_BATCH_SIZE),
    maxEmailsPerRun: parsePositiveInt(
      env.GTD_MAX_EMAILS_PER_RUN,
      fileConfig.maxEmailsPerRun ?? DEFAULT_MAX_EMAILS_PER_RUN,
    ),
    maxLlmCallsPerRun: parsePositiveInt(
      env.GTD_MAX_LLM_CALLS_PER_RUN,
      fileConfig.maxLlmCallsPerRun ?? DEFAULT_MAX_LLM_CALLS_PER_RUN,
    ),
    lookbackDays: parsePositiveInt(env.GTD_LOOKBACK_DAYS, fileConfig.lookbackDays ?? DEFAULT_LOOKBACK_DAYS),
    appHomeDir: env.GTD_APP_HOME_DIR ?? fileConfig.appHomeDir ?? APP_HOME_DIR,
    stateFilePath: env.GTD_STATE_PATH ?? fileConfig.stateFilePath ?? DEFAULT_STATE_PATH,
    classificationCachePath:
      env.GTD_CLASSIFICATION_CACHE_PATH ?? fileConfig.classificationCachePath ?? DEFAULT_CLASSIFICATION_CACHE_PATH,
    logGraphApiToFile: parseBoolean(
      env.LOG_GRAPH_API_TO_FILE,
      fileConfig.logGraphApiToFile ?? false,
    ),
    logGraphApiFilePath:
      env.LOG_GRAPH_API_FILE_PATH ?? fileConfig.logGraphApiFilePath ?? undefined,
    autoApproveHighImportance: parseBoolean(
      env.GTD_AUTO_APPROVE_HIGH_IMPORTANCE,
      fileConfig.autoApproveHighImportance ?? DEFAULT_AUTO_APPROVE_HIGH_IMPORTANCE,
    ),
  };

  const required = requireGraphCredentials(merged);

  return {
    graphClientId: required.graphClientId,
    graphTenantId: required.graphTenantId,
    batchSize: merged.batchSize ?? DEFAULT_BATCH_SIZE,
    maxEmailsPerRun: merged.maxEmailsPerRun ?? DEFAULT_MAX_EMAILS_PER_RUN,
    maxLlmCallsPerRun: merged.maxLlmCallsPerRun ?? DEFAULT_MAX_LLM_CALLS_PER_RUN,
    lookbackDays: merged.lookbackDays ?? DEFAULT_LOOKBACK_DAYS,
    appHomeDir: merged.appHomeDir ?? APP_HOME_DIR,
    stateFilePath: merged.stateFilePath ?? DEFAULT_STATE_PATH,
    classificationCachePath: merged.classificationCachePath ?? DEFAULT_CLASSIFICATION_CACHE_PATH,
    logGraphApiToFile: merged.logGraphApiToFile ?? false,
    logGraphApiFilePath: merged.logGraphApiFilePath ?? undefined,
    autoApproveHighImportance: merged.autoApproveHighImportance ?? DEFAULT_AUTO_APPROVE_HIGH_IMPORTANCE,
  };
}

export function writeSetupConfig(
  input: SetupConfigInput,
  options: {
    configPath?: string;
    fsOps?: FsOps;
  } = {},
): string {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const fsOps = options.fsOps ?? defaultFsOps;
  const payload: Partial<AppSettings> = {
    graphClientId: input.graphClientId.trim(),
    graphTenantId: input.graphTenantId.trim(),
    logGraphApiToFile: false,
    logGraphApiFilePath: undefined,
  };

  fsOps.mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  fsOps.writeFileSync(configPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fsOps.chmodSync(configPath, 0o600);
  return configPath;
}
