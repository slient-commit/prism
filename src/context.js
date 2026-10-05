// Loads optional PRISM*.md files from the reviewed project's root.
//   App context  → PRISM*.md (minus the prompt file): domain knowledge.
//   User prompt  → PRISM*PROMPT.md: extra review instructions.
// Absent → "" (review proceeds without it).
//
// Override the search dir with PRISM_CONTEXT_DIR, or point at an exact file
// with PRISM_CONTEXT_FILE / PRISM_PROMPT_FILE.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PROMPT_RE = /^PRISM.*PROMPT\.md$/i;

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function findPrismMd({ match, dir, envFile }) {
  const explicit = envFile && process.env[envFile];
  if (explicit) return read(explicit);
  let file;
  try {
    file = readdirSync(dir).find(match);
  } catch {
    return "";
  }
  return file ? read(join(dir, file)) : "";
}

export function getAppContext(dir = process.env.PRISM_CONTEXT_DIR || ".") {
  return findPrismMd({
    dir,
    envFile: "PRISM_CONTEXT_FILE",
    match: (n) => /^PRISM.*\.md$/i.test(n) && !PROMPT_RE.test(n),
  });
}

export function getUserPrompt(dir = process.env.PRISM_CONTEXT_DIR || ".") {
  return findPrismMd({
    dir,
    envFile: "PRISM_PROMPT_FILE",
    match: (n) => PROMPT_RE.test(n),
  });
}

// Self-check: PRISM_CONTEXT_SELFCHECK=1 node src/context.js
if (process.env.PRISM_CONTEXT_SELFCHECK) {
  if (getAppContext("does-not-exist") !== "") throw new Error("missing dir → empty");
  console.log("ok: context", JSON.stringify(getAppContext().slice(0, 30)), "| prompt", JSON.stringify(getUserPrompt().slice(0, 30)));
}
