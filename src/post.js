// Post the review to the PR as a single comment. Works on GitHub and Gitea —
// both expose POST /repos/{owner}/{repo}/issues/{n}/comments and set GITHUB_*
// env vars in their Actions runners (Gitea points GITHUB_API_URL at itself).
//
// Env: GITHUB_API_URL (default api.github.com), GITHUB_REPOSITORY (owner/repo),
//      PRISM_TOKEN | GITHUB_TOKEN, PRISM_PR | GITHUB_REF (refs/pull/<n>/...).

import { isFailed } from "./reviewer.js";

const BADGE = { info: "ℹ️", warning: "⚠️", error: "⛔", fatal: "🛑" };

// Build a compact markdown comment from a review result.
export function formatComment({ findings }) {
  if (!findings.length) return "PRISM: LGTM ✅";
  const header = isFailed(findings) ? "PRISM review ❌ (blocking)" : "PRISM review ⚠️";
  const lines = findings.map((f) => {
    const loc = [f.file, f.line].filter(Boolean).join(":");
    const code = f.code ? ` \`${f.code.trim()}\`` : "";
    const badge = `${BADGE[f.level] || ""} ${f.level.toUpperCase()}`.trim();
    return `- ${badge} ${loc ? `**${loc}**` : ""}${code} — ${f.note || ""}`.replace(/\s+/g, " ").trim();
  });
  return `${header}\n${lines.join("\n")}`;
}

function prNumber() {
  if (process.env.PRISM_PR) return process.env.PRISM_PR;
  const m = /refs\/pull\/(\d+)\//.exec(process.env.GITHUB_REF || "");
  return m && m[1];
}

export async function postComment(result) {
  const body = formatComment(result);
  const api = process.env.GITHUB_API_URL || "https://api.github.com";
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.PRISM_TOKEN || process.env.GITHUB_TOKEN;
  const pr = prNumber();

  if (!repo || !token || !pr) {
    throw new Error("missing GITHUB_REPOSITORY, token, or PR number");
  }

  const res = await fetch(`${api}/repos/${repo}/issues/${pr}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new Error(`comment failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Self-check: PRISM_POST_SELFCHECK=1 node src/post.js
if (process.env.PRISM_POST_SELFCHECK) {
  console.log(formatComment({ lgtm: true, findings: [] }));
  console.log(
    formatComment({
      lgtm: false,
      findings: [{ file: "src/a.js", line: 12, code: "x==null", note: "use ===" }],
    })
  );
}
