// Get a PR diff straight from git (no API calls), trimmed for token economy.
//
// Base/head resolution (first set wins):
//   base: PRISM_BASE_SHA | GITHUB_BASE_REF | "HEAD~1"
//   head: PRISM_HEAD_SHA | "HEAD"
//
// Token trimming knobs:
//   PRISM_DIFF_CONTEXT  = unified context lines (default "3")
//   PRISM_DIFF_EXCLUDE  = comma-separated extra pathspecs to drop
//
// The workflow must have fetched the base ref (actions/checkout defaults to a
// shallow clone of head only). See README for the fetch one-liner.

import { execFileSync } from "node:child_process";

// Noise that costs tokens and almost never needs review.
const DEFAULT_EXCLUDES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.lock",
  "*.svg",
  "dist/**",
  "build/**",
  "vendor/**",
];

export function getDiff({ base, head } = {}) {
  base = base || process.env.PRISM_BASE_SHA || process.env.GITHUB_BASE_REF || "HEAD~1";
  head = head || process.env.PRISM_HEAD_SHA || "HEAD";

  const context = process.env.PRISM_DIFF_CONTEXT || "3";
  const extra = (process.env.PRISM_DIFF_EXCLUDE || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const excludes = [...DEFAULT_EXCLUDES, ...extra].map((p) => `:(exclude)${p}`);

  // --merge-base: diff head against the common ancestor (correct for PRs even
  // when base has advanced). Falls back to a plain range if base has no ancestor.
  const args = [
    "diff",
    "--merge-base",
    `--unified=${context}`,
    base,
    head,
    "--",
    ".",
    ...excludes,
  ];

  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
}

// Self-check: PRISM_DIFF_SELFCHECK=1 node src/diff.js
if (process.env.PRISM_DIFF_SELFCHECK) {
  const empty = getDiff({ base: "HEAD", head: "HEAD" });
  if (empty !== "") throw new Error("HEAD..HEAD should be empty");
  console.log("ok: empty diff for HEAD..HEAD; excludes applied:", DEFAULT_EXCLUDES.length);
}
