/**
 * Lightweight checks for capture set consensus thresholds.
 * Run: node scripts/test-southern-islands-logic.mjs
 */
import assert from "node:assert/strict";

function batchThreshold(groupSize) {
  return Math.min(12, Math.max(6, Math.ceil(groupSize * (2 / 3))));
}

assert.equal(batchThreshold(18), 12);
assert.equal(batchThreshold(9), 6);

console.log("set-identification consensus: ok");
