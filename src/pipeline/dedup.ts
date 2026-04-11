// TODO: Content-hash deduplication (xxhash-wasm + SQLite)
// - Compute XXH64 hash of normalized_subject + normalized_body
// - Lookup in SQLite classification cache
// - Cache hit → reuse stored classification
// - Cache miss → classify and store
// - Cache eviction: 30-day TTL, 50K max entries
