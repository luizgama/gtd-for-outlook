import { homedir } from "node:os";
import { join } from "node:path";

export const APP_HOME_DIR = join(homedir(), ".gtd-outlook");
export const DEFAULT_CONFIG_PATH = join(APP_HOME_DIR, "config.json");
export const DEFAULT_STATE_PATH = join(APP_HOME_DIR, "state.json");
export const DEFAULT_CLASSIFICATION_CACHE_PATH = join(APP_HOME_DIR, "classification-cache.sqlite");

export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_MAX_EMAILS_PER_RUN = 200;
export const DEFAULT_MAX_LLM_CALLS_PER_RUN = 500;
export const DEFAULT_LOOKBACK_DAYS = 7;
export const DEFAULT_AUTO_APPROVE_HIGH_IMPORTANCE = false;
