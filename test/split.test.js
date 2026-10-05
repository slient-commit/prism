import { test } from "node:test";
import assert from "node:assert/strict";
import { truncate, splitDiff } from "../src/split.js";

test("truncate: under limit is unchanged", () => {
  assert.equal(truncate("abc", 10), "abc");
  assert.equal(truncate("", 10), "");
});

test("truncate: over limit is cut with marker", () => {
  assert.equal(truncate("abcdef", 3), "abc\n…[truncated 3 chars]");
});

test("splitDiff: empty/whitespace yields no chunks", () => {
  assert.deepEqual(splitDiff("", 100), []);
  assert.deepEqual(splitDiff("   \n", 100), []);
});

test("splitDiff: small diff is one chunk", () => {
  const d = "diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b\n";
  assert.deepEqual(splitDiff(d, 1000), [d]);
});

const file = (n, size) =>
  `diff --git a/f${n} b/f${n}\n--- a/f${n}\n+++ b/f${n}\n@@ -1 +1 @@\n+${"y".repeat(size)}\n`;

test("splitDiff: packs whole files under the limit", () => {
  const d = file(1, 20) + file(2, 20) + file(3, 20);
  const chunks = splitDiff(d, 90);
  assert.ok(chunks.length > 1, "should split");
  // every packed chunk (one that didn't need header-duplication) stays under max
  for (const c of chunks) {
    if (/^diff --git /.test(c)) assert.ok(c.length <= 90, `chunk ${c.length} > 90`);
  }
  assert.equal(chunks.join(""), d, "packing is lossless");
});

test("splitDiff: oversized single file splits by hunk, header kept", () => {
  const big =
    "diff --git a/f b/f\n--- a/f\n+++ b/f\n" +
    "@@ -1 +1 @@\n+" + "a".repeat(40) + "\n" +
    "@@ -2 +2 @@\n+" + "b".repeat(40) + "\n";
  const chunks = splitDiff(big, 80);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.match(c, /^diff --git a\/f/, "each sub-chunk keeps the file header");
  }
});
