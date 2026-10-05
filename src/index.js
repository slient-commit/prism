#!/usr/bin/env node
// PRISM entry point. Run from the reviewed project's checkout in CI:
//   npx prism   (or: node node_modules/prism/src/index.js)
//
// Reads the PR diff from git, loads optional PRISM*.md context/prompt, runs the
// review, prints it, and (when a token + PR are present) posts a PR comment.
// Set PRISM_FAIL_ON_FINDINGS=1 to make the job fail when issues are found.

import { getDiff } from "./diff.js";
import { getAppContext, getUserPrompt } from "./context.js";
import { review } from "./reviewer.js";
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

  if (!result.lgtm && process.env.PRISM_FAIL_ON_FINDINGS) process.exit(1);
}

main().catch((e) => {
  console.error("PRISM:", e.message);
  process.exit(1);
});
