#!/usr/bin/env node
// PRISM entry point. Run from the reviewed project's checkout in CI:
//   npx prism   (or: node node_modules/prism/src/index.js)
//
// Reads the PR diff from git, loads optional PRISM*.md context/prompt, runs the
// review, prints it, and (when a token + PR are present) posts a PR comment.
// Exits 1 if any finding is level error or fatal (fails the pipeline).

import { getDiff } from "./diff.js";
import { getAppContext, getUserPrompt } from "./context.js";
import { review, isFailed } from "./reviewer.js";
import { formatComment, postComment } from "./post.js";

async function main() {
  const diff = getDiff();
  const result = await review({
    diff,
    context: getAppContext(),
    userPrompt: getUserPrompt(),
  });

  console.log(formatComment(result));

  const token = process.env.PRISM_TOKEN || process.env.GITHUB_TOKEN;
  if (token && process.env.GITHUB_REPOSITORY) {
    try {
      await postComment(result);
    } catch (e) {
      console.error("PRISM: comment failed:", e.message);
    }
  }

  if (isFailed(result.findings)) process.exit(1);
}

main().catch((e) => {
  console.error("PRISM:", e.message);
  process.exit(1);
});
