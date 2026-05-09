import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

const ITERATIONS = 1000;
const PAYLOAD =
  "Subject: Incident Update\nFrom: test@example.com\nBody: This is a representative email body with metadata and content.";

function hash(input) {
  return createHash("sha256").update(input).digest("hex");
}

const expected = hash(PAYLOAD);
let deterministic = true;

const start = performance.now();
for (let i = 0; i < ITERATIONS; i += 1) {
  const current = hash(PAYLOAD);
  if (current !== expected) {
    deterministic = false;
    break;
  }
}
const end = performance.now();

console.log(
  JSON.stringify(
    {
      algorithm: "sha256",
      iterations: ITERATIONS,
      deterministic,
      sampleHash: expected,
      totalMs: Number((end - start).toFixed(3)),
      avgMsPerHash: Number((((end - start) / ITERATIONS) || 0).toFixed(6)),
    },
    null,
    2,
  ),
);

if (!deterministic) {
  throw new Error("SHA-256 hash output was not deterministic.");
}
