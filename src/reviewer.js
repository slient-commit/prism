// The brain: assembles the prompt and runs the review.
//   system = default reviewer prompt (+ app context, if any)
//   user   = optional user-prompt instructions + the diff

import { complete } from "./llm.js";
import { truncate, splitDiff } from "./split.js";

const int = (v, d) => (v && Number(v) > 0 ? Number(v) : d);
const MAX_CONTEXT = int(process.env.PRISM_MAX_CONTEXT, 20000);
const MAX_PROMPT = int(process.env.PRISM_MAX_PROMPT, 8000);
const MAX_DIFF_CHARS = int(process.env.PRISM_MAX_DIFF_CHARS, 60000);

export const LEVELS = ["info", "warning", "error", "fatal"];
const BLOCKING = new Set(["error", "fatal"]);

export const DEFAULT_SYSTEM = `You are PRISM, a concise code reviewer for pull requests.
Review only the diff provided. Report real problems: bugs, security issues,
broken logic, and clear regressions. Skip style nitpicks and praise.

Reply with ONLY a JSON object, no prose, no markdown fences:
- If the diff is sound: {"findings":[]}
- Otherwise: {"findings":[{"file":"path","line":12,"code":"the offending line, only if it clarifies","note":"one short sentence: problem + why","level":"info|warning|error|fatal"}]}

Levels:
- info: minor note / FYI, no action needed
- warning: should fix, but does not block merge
- error: must fix, blocks merge
- fatal: critical — security hole, data loss, or breaking change

Use error/fatal only for genuine blockers. Omit "code" unless it helps.
Keep every "note" terse — tokens cost money.`;

// True when any finding should fail the pipeline.
export function isFailed(findings) {
  return findings.some((f) => BLOCKING.has(f.level));
}

// Returns { findings: [{file, line, code?, note, level}] }.
// Empty findings = LGTM. diff: string (required); context/userPrompt: "" when absent.
export async function review({ diff, context = "", userPrompt = "" }) {
  if (!diff || !diff.trim()) return { findings: [] };

  context = truncate(context, MAX_CONTEXT);
  userPrompt = truncate(userPrompt, MAX_PROMPT);

  let system = DEFAULT_SYSTEM;
  if (userPrompt) system += `\n\n${userPrompt}`;
  if (context) system += `\n\n# Project context\n${context}`;

  // One call per chunk; merge all findings.
  const chunks = splitDiff(diff, MAX_DIFF_CHARS);
  const findings = [];
  for (const chunk of chunks) {
    const raw = await complete({ system, user: `# Diff to review\n${chunk}` });
    findings.push(...parseResult(raw));
  }
  return { findings };
}

// Tolerant parse: strip accidental ``` fences; normalize levels; on failure,
// keep the text as a single warning so nothing is silently lost. Returns an
// array of findings.
export function parseResult(text) {
  const cleaned = String(text).replace(/```(?:json)?/gi, "").trim();
  try {
    const o = JSON.parse(cleaned);
    const findings = Array.isArray(o.findings) ? o.findings : [];
    return findings.map(normalize);
  } catch {
    return cleaned ? [{ note: cleaned, level: "warning" }] : [];
  }
}

// Default a missing/invalid level to "warning" (non-blocking).
function normalize(f) {
  return LEVELS.includes(f.level) ? f : { ...f, level: "warning" };
}
