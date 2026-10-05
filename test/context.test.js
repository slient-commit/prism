import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAppContext, getUserPrompt } from "../src/context.js";

function withDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "prism-"));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("missing dir yields empty strings", () => {
  assert.equal(getAppContext("no-such-dir"), "");
  assert.equal(getUserPrompt("no-such-dir"), "");
});

test("context matches PRISM*.md but not the prompt file", () => {
  withDir({ "PRISM.md": "ctx", "PRISM_PROMPT.md": "prm" }, (dir) => {
    assert.equal(getAppContext(dir), "ctx");
    assert.equal(getUserPrompt(dir), "prm");
  });
});

test("prompt file is not mistaken for context when alone", () => {
  withDir({ "PRISM_PROMPT.md": "prm" }, (dir) => {
    assert.equal(getAppContext(dir), "");
    assert.equal(getUserPrompt(dir), "prm");
  });
});

test("case-insensitive match", () => {
  withDir({ "prism_context.md": "ctx" }, (dir) => {
    assert.equal(getAppContext(dir), "ctx");
  });
});
