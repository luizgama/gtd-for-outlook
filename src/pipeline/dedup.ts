import { createHash } from "node:crypto";
import type { ClassificationResult } from "../security/schemas.js";

export interface DedupCacheResult {
  hit: boolean;
  classification?: ClassificationResult;
}

type CacheRecord = {
  classification: ClassificationResult;
  createdAtMs: number;
};

export interface DedupOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 50_000;

export function normalizeForHash(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function computeContentHash(normalizedSubject: string, normalizedBody: string): string {
  return createHash("sha256")
    .update(`${normalizedSubject}\n${normalizedBody}`, "utf8")
    .digest("hex");
}

export class DedupCache {
  private readonly records = new Map<string, CacheRecord>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: DedupOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? (() => Date.now());
  }

  private evictExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [hash, record] of this.records) {
      if (record.createdAtMs < cutoff) {
        this.records.delete(hash);
      }
    }
  }

  private evictOverflow(): void {
    while (this.records.size > this.maxEntries) {
      const oldest = this.records.keys().next();
      if (oldest.done) {
        return;
      }
      this.records.delete(oldest.value);
    }
  }

  async getCachedClassification(normalizedSubject: string, normalizedBody: string): Promise<DedupCacheResult> {
    this.evictExpired();
    const hash = computeContentHash(normalizedSubject, normalizedBody);
    const record = this.records.get(hash);
    if (!record) {
      return { hit: false };
    }
    return { hit: true, classification: record.classification };
  }

  async storeCachedClassification(
    normalizedSubject: string,
    normalizedBody: string,
    classification: ClassificationResult,
  ): Promise<void> {
    this.evictExpired();
    const hash = computeContentHash(normalizedSubject, normalizedBody);
    this.records.set(hash, {
      classification,
      createdAtMs: this.now(),
    });
    this.evictOverflow();
  }
}
