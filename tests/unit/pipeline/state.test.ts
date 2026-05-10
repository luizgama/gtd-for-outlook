import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProcessingStateStore } from "../../../src/pipeline/state";

describe("pipeline/state", () => {
  it("loads empty state when file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-state-"));
    try {
      const store = new ProcessingStateStore(join(dir, "state.json"));
      expect(store.load()).toEqual({ processed: {} });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it(
    "persists and reloads processed message state",
    () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-state-"));
      try {
        const store = new ProcessingStateStore(join(dir, "state.json"));
        store.markProcessed("m1", "@Action");
        const reloaded = store.getProcessed("m1");
        expect(reloaded?.messageId).toBe("m1");
        expect(reloaded?.category).toBe("@Action");
        expect(typeof reloaded?.organizedAt).toBe("string");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    15000,
  );

  it("returns empty state when file is corrupt JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-state-"));
    try {
      const path = join(dir, "state.json");
      writeFileSync(path, "{not-json");
      const store = new ProcessingStateStore(path);
      expect(store.load()).toEqual({ processed: {} });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
