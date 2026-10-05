# PRISM

A lightweight, AI-powered pull request reviewer. It reads the PR diff straight
from git, sends it to Claude or OpenAI, and posts a concise review back to the
PR as a comment. Built to run inside GitHub Actions or Gitea Actions with
minimal token spend.

## How it works

```
git diff ──► trim (excludes, split) ──► LLM review ──► JSON ──► PR comment
             + optional PRISM*.md context/prompt
```

1. Gets the diff from git (`--merge-base`, excludes lockfiles/minified/vendored).
2. Loads optional `PRISM*.md` files from the reviewed repo for context/instructions.
3. Splits oversized diffs into per-call chunks to stay within token budgets.
4. Asks the model for a compact JSON verdict: `LGTM` or a list of findings.
5. Posts one comment to the PR (GitHub or Gitea).

## Requirements

- Node.js 22+
- An API key for Claude (Anthropic) or OpenAI.

## Install

In the project you want reviewed, install from the git repo:

```bash
npm install --save-dev github:slient-commit/prism
```

This exposes a `prism` binary. Run it from the repo root:

```bash
npx prism
```

## Quick start — GitHub Actions

```yaml
# .github/workflows/review.yml
name: PRISM review
on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # actions/checkout is shallow (head only) — fetch the base ref to diff against
      - run: git fetch --no-tags --depth=1 origin $GITHUB_BASE_REF
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install --save-dev github:slient-commit/prism
      - run: npx prism
        env:
          PRISM_PROVIDER: claude
          PRISM_API_KEY: ${{ secrets.PRISM_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Quick start — Gitea Actions

Identical, because Gitea sets the same `GITHUB_*` variables in its runner and
points `GITHUB_API_URL` at itself:

```yaml
# .gitea/workflows/review.yml
name: PRISM review
on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: git fetch --no-tags --depth=1 origin $GITHUB_BASE_REF
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install --save-dev github:slient-commit/prism
      - run: npx prism
        env:
          PRISM_PROVIDER: openai
          PRISM_API_KEY: ${{ secrets.PRISM_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> The token needs permission to write PR comments. On GitHub, the default
> `GITHUB_TOKEN` works if the workflow has `permissions: pull-requests: write`.

## Configuration

All options are environment variables. Only `PRISM_API_KEY` is required.

### Provider

| Variable         | Default            | Description                                   |
| ---------------- | ------------------ | --------------------------------------------- |
| `PRISM_API_KEY`  | —                  | **Required.** API key for the chosen provider.|
| `PRISM_PROVIDER` | `claude`           | `claude` or `openai`.                          |
| `PRISM_MODEL`    | `claude-opus-4-8` / `gpt-4o` | Model id. Default depends on provider.|

### Diff selection

| Variable             | Default                           | Description                                 |
| -------------------- | --------------------------------- | ------------------------------------------- |
| `PRISM_BASE_SHA`     | `GITHUB_BASE_REF` → `HEAD~1`      | Base ref/sha to diff against.               |
| `PRISM_HEAD_SHA`     | `HEAD`                             | Head ref/sha.                               |
| `PRISM_DIFF_CONTEXT` | `3`                               | Unified context lines. Lower = fewer tokens.|
| `PRISM_DIFF_EXCLUDE` | —                                 | Extra comma-separated pathspecs to drop.    |

Always excluded: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `*.min.js`,
`*.min.css`, `*.map`, `*.lock`, `*.svg`, `dist/**`, `build/**`, `vendor/**`.

### Token limits

Char-based caps (≈4 chars per token). Context/prompt are truncated; the diff is
split into multiple review calls.

| Variable               | Default | Description                              |
| ---------------------- | ------- | ---------------------------------------- |
| `PRISM_MAX_CONTEXT`    | `20000` | Max chars of app context.                |
| `PRISM_MAX_PROMPT`     | `8000`  | Max chars of the user-prompt file.       |
| `PRISM_MAX_DIFF_CHARS` | `60000` | Max chars of diff per API call.          |

### PR comment target

Auto-detected from the Actions environment; override only if needed.

| Variable            | Default                | Description                           |
| ------------------- | ---------------------- | ------------------------------------- |
| `PRISM_TOKEN`       | `GITHUB_TOKEN`         | Token with PR-comment permission.     |
| `GITHUB_REPOSITORY` | (set by runner)        | `owner/repo`.                         |
| `GITHUB_API_URL`    | `https://api.github.com` | API base (Gitea sets this itself).  |
| `PRISM_PR`          | parsed from `GITHUB_REF` | PR number.                           |

If no token/PR is present, PRISM just prints the review to stdout instead of
posting — useful for local runs.

## Optional project files

Drop either in the root of the **reviewed** project. Both are optional.

- **`PRISM*.md`** (e.g. `PRISM.md`, `PRISM_CONTEXT.md`) — app context (architecture,
  conventions, gotchas). Folded into the system prompt so the reviewer
  understands your codebase.
- **`PRISM*PROMPT.md`** (e.g. `PRISM_PROMPT.md`) — extra review instructions,
  appended to the default system prompt (e.g. "focus on auth and SQL injection").

## Review output & pipeline result

The model returns JSON, rendered into a single PR comment. Every finding has a
severity level:

| Level     | Meaning                                   | Blocks pipeline? |
| --------- | ----------------------------------------- | ---------------- |
| `info`    | Minor note / FYI                          | No               |
| `warning` | Should fix, non-blocking                  | No               |
| `error`   | Must fix, blocks merge                    | **Yes**          |
| `fatal`   | Critical — security, data loss, breaking  | **Yes**          |

- **No issues:** comment is `PRISM: LGTM ✅`, job **succeeds**.
- **Only info/warning:** findings are posted, job still **succeeds**.
- **Any error/fatal:** findings are posted and `prism` **exits 1**, failing the job.

Each finding renders as `LEVEL **file:line** \`code\` — note`.

## Local usage

```bash
export PRISM_API_KEY=sk-...
export PRISM_PROVIDER=claude
# diff the last commit and print the review (no posting without a token/PR)
PRISM_BASE_SHA=HEAD~1 npx prism
```

## Development

```bash
npm install
npm test        # node --test, no framework
```

## License

ISC
