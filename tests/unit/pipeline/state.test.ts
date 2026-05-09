import { writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProcessingStateStore } from "../../../src/pipeline/state";

describe("pipeline/state", () => {
  it("loads empty state when file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-state-"));
    const store = new ProcessingStateStore(join(dir, "state.json"));
    expect(store.load()).toEqual({ processed: {} });
  });

  it("persists and reloads processed message state", () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-state-"));
    const store = new ProcessingStateStore(join(dir, "state.json"));

    store.markProcessed("m1", "@Action");
    const reloaded = store.getProcessed("m1");
    expect(reloaded?.messageId).toBe("m1");
    expect(reloaded?.category).toBe("@Action");
    expect(typeof reloaded?.organizedAt).toBe("string");
  });

  it("returns empty state when file is corrupt JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "gtd-state-"));
    const path = join(dir, "state.json");
    writeFileSync(path, "{not-json");
    const store = new ProcessingStateStore(path);
    expect(store.load()).toEqual({ processed: {} });
  });
});
