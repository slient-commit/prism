import { test } from "node:test";
import assert from "node:assert/strict";
import { parseResult, review, isFailed } from "../src/reviewer.js";

test("parseResult: empty findings = lgtm", () => {
  assert.deepEqual(parseResult('{"findings":[]}'), []);
});

test("parseResult: strips ``` fences and keeps level", () => {
  const r = parseResult('```json\n{"findings":[{"file":"a.js","line":3,"note":"bug","level":"error"}]}\n```');
  assert.deepEqual(r, [{ file: "a.js", line: 3, note: "bug", level: "error" }]);
});

test("parseResult: missing/invalid level defaults to warning", () => {
  assert.deepEqual(parseResult('{"findings":[{"note":"x"}]}'), [{ note: "x", level: "warning" }]);
  assert.deepEqual(parseResult('{"findings":[{"note":"y","level":"bogus"}]}'), [{ note: "y", level: "warning" }]);
});

test("parseResult: garbage becomes a single warning", () => {
  assert.deepEqual(parseResult("not json"), [{ note: "not json", level: "warning" }]);
});

test("parseResult: empty text yields no findings", () => {
  assert.deepEqual(parseResult(""), []);
});

test("isFailed: only error/fatal block", () => {
  assert.equal(isFailed([]), false);
  assert.equal(isFailed([{ level: "info" }, { level: "warning" }]), false);
  assert.equal(isFailed([{ level: "warning" }, { level: "error" }]), true);
  assert.equal(isFailed([{ level: "fatal" }]), true);
});

test("review: empty diff short-circuits without calling the model", async () => {
  // no PRISM_API_KEY needed — must not reach the provider
  assert.deepEqual(await review({ diff: "" }), { findings: [] });
});
