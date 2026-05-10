import { describe, expect, it } from "vitest";
import { computeContentHash, DedupCache, normalizeForHash } from "../../../src/pipeline/dedup";

describe("pipeline/dedup", () => {
  it("returns miss then hit after storing classification", async () => {
    const cache = new DedupCache();
    const subject = normalizeForHash("Subject");
    const body = normalizeForHash("Body");
    const miss = await cache.getCachedClassification(subject, body);
    expect(miss.hit).toBe(false);

    await cache.storeCachedClassification(subject, body, {
      category: "@Action",
      confidence: 0.8,
      reason: "Action",
    });
    const hit = await cache.getCachedClassification(subject, body);
    expect(hit.hit).toBe(true);
    expect(hit.classification?.category).toBe("@Action");
  });

  it("produces deterministic hashes for identical normalized inputs", () => {
    const hashA = computeContentHash(normalizeForHash(" A  "), normalizeForHash("Body"));
    const hashB = computeContentHash(normalizeForHash("a"), normalizeForHash("body"));
    expect(hashA).toBe(hashB);
  });

  it("produces different hashes for different content", () => {
    const hashA = computeContentHash("subject", "body");
    const hashB = computeContentHash("subject", "body2");
    expect(hashA).not.toBe(hashB);
  });

  it("evicts expired entries by ttl", async () => {
    let now = 1000;
    const cache = new DedupCache({
      ttlMs: 100,
      now: () => now,
    });
    await cache.storeCachedClassification("subject", "body", {
      category: "@Reference",
      confidence: 0.7,
      reason: "Ref",
    });
    now = 1201;
    const result = await cache.getCachedClassification("subject", "body");
    expect(result.hit).toBe(false);
  });

  it("evicts oldest entries when max size is exceeded", async () => {
    const cache = new DedupCache({
      maxEntries: 1,
    });
    await cache.storeCachedClassification("a", "a", {
      category: "@Reference",
      confidence: 0.7,
      reason: "one",
    });
    await cache.storeCachedClassification("b", "b", {
      category: "@Action",
      confidence: 0.8,
      reason: "two",
    });

    expect((await cache.getCachedClassification("a", "a")).hit).toBe(false);
    expect((await cache.getCachedClassification("b", "b")).hit).toBe(true);
  });
});
