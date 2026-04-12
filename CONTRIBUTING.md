# Contributing

## Branch Naming

Format: `{agent}/{issue-number}-{short-description}`

## Commit Messages

Use Conventional Commits: feat:, fix:, docs:, refactor:, chore:

## Pull Requests

- Never push to main directly — branches + PRs only
- Update PROJECT.md before opening the PR
- Update PROGRESS.md after every change (mandatory per CLAUDE.md)

## Rules

1. Everything is files on disk — no database
2. Path traversal prevention — all paths must start with DATA_DIR
3. AI edits should be targeted — never replace entire files
4. Dark mode default
