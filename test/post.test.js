import { test } from "node:test";
import assert from "node:assert/strict";
import { formatComment, postComment } from "../src/post.js";

test("formatComment: lgtm", () => {
  assert.equal(formatComment({ lgtm: true, findings: [] }), "PRISM: LGTM ✅");
});

test("formatComment: findings render level, file:line, code, note", () => {
  const out = formatComment({
    findings: [{ file: "src/a.js", line: 12, code: "x==null", note: "use ===", level: "error" }],
  });
  assert.match(out, /PRISM review ❌ \(blocking\)/);
  assert.match(out, /ERROR/);
  assert.match(out, /\*\*src\/a\.js:12\*\*/);
  assert.match(out, /`x==null`/);
  assert.match(out, /use ===/);
});

test("formatComment: warnings only are non-blocking", () => {
  const out = formatComment({ findings: [{ note: "nit", level: "warning" }] });
  assert.match(out, /PRISM review ⚠️/);
  assert.doesNotMatch(out, /blocking/);
});

test("postComment: throws when env is incomplete", async () => {
  const saved = { ...process.env };
  delete process.env.GITHUB_REPOSITORY;
  delete process.env.PRISM_TOKEN;
  delete process.env.GITHUB_TOKEN;
  delete process.env.PRISM_PR;
  delete process.env.GITHUB_REF;
  try {
    await assert.rejects(() => postComment({ lgtm: true, findings: [] }), /missing/);
  } finally {
    Object.assign(process.env, saved);
  }
});

test("postComment: POSTs to the issues endpoint with the formatted body", async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, json: async () => ({ id: 1 }) };
  };
  Object.assign(process.env, {
    GITHUB_API_URL: "https://git.example.com/api/v1",
    GITHUB_REPOSITORY: "owner/repo",
    GITHUB_TOKEN: "tok",
    PRISM_PR: "42",
  });
  try {
    await postComment({ lgtm: true, findings: [] });
    assert.equal(captured.url, "https://git.example.com/api/v1/repos/owner/repo/issues/42/comments");
    assert.equal(captured.opts.method, "POST");
    assert.match(captured.opts.headers.Authorization, /Bearer tok/);
    assert.equal(JSON.parse(captured.opts.body).body, "PRISM: LGTM ✅");
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ["GITHUB_API_URL", "GITHUB_REPOSITORY", "GITHUB_TOKEN", "PRISM_PR"]) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("postComment: derives PR number from GITHUB_REF", async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url) => {
    captured = url;
    return { ok: true, json: async () => ({}) };
  };
  Object.assign(process.env, {
    GITHUB_REPOSITORY: "o/r",
    GITHUB_TOKEN: "t",
    GITHUB_REF: "refs/pull/7/merge",
  });
  delete process.env.PRISM_PR;
  delete process.env.GITHUB_API_URL;
  try {
    await postComment({ lgtm: true, findings: [] });
    assert.match(captured, /\/repos\/o\/r\/issues\/7\/comments$/);
  } finally {
    globalThis.fetch = realFetch;
    Object.assign(process.env, saved);
  }
});
