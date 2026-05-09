import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type ProcessedMessageState = {
  messageId: string;
  category: string;
  organizedAt: string;
};

type StateFile = {
  processed: Record<string, ProcessedMessageState>;
};

const DEFAULT_STATE_PATH = join(homedir(), ".gtd-outlook", "state.json");

export class ProcessingStateStore {
  private readonly path: string;

  constructor(path = DEFAULT_STATE_PATH) {
    this.path = path;
  }

  load(): StateFile {
    if (!existsSync(this.path)) {
      return { processed: {} };
    }
    const raw = readFileSync(this.path, "utf8").trim();
    if (!raw) {
      return { processed: {} };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StateFile>;
      return { processed: parsed.processed ?? {} };
    } catch {
      return { processed: {} };
    }
  }

  save(state: StateFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(state, null, 2));
  }

  getProcessed(messageId: string): ProcessedMessageState | null {
    return this.load().processed[messageId] ?? null;
  }

  markProcessed(messageId: string, category: string): ProcessedMessageState {
    const state = this.load();
    const entry: ProcessedMessageState = {
      messageId,
      category,
      organizedAt: new Date().toISOString(),
    };
    state.processed[messageId] = entry;
    this.save(state);
    return entry;
  }
}

export function createProcessingStateStore(path?: string): ProcessingStateStore {
  return new ProcessingStateStore(path);
}
