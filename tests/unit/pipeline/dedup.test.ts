// TODO: Tests for pipeline/dedup.ts
// - Cache miss → classify and store
// - Cache hit → return stored classification
// - Identical emails produce same hash
// - Different emails produce different hashes
// - Cache eviction after TTL expiry
// - Cache eviction at max entries
