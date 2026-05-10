# AGENTS.md

This repository is codex-job-kit, an open-source job-search workspace for Codex. Keep changes generic and reusable.

`SPEC.md` defines the workflow rules. The `job-tracker/` app provides the tracker UI and CLI commands.

## Rules

1. Do not commit private candidate data, real application history, resumes, cover letters, browser profiles, cookies, or SQLite databases.
2. Keep workflow prompts configurable with placeholders instead of personal paths, locations, or credentials.
3. Treat `job-tracker/data/jobs.db` and `job-tracker/storage/` as local runtime data only.
4. Prefer `browser-use` for workflow browser automation.
5. Keep the tracker website, CLI import/lookup commands, shortlist workflow, and process-summary graph straightforward for standalone use.
6. Keep optional integrations out of the default workflow unless the user explicitly asks for them.

## Setup Trigger

When a user says "help me set it up", "set up this repo", "configure my job search", or similar, read `SPEC.md`, `docs/setup-with-codex.md`, and `.codex/skills/codex-job-kit-setup/SKILL.md` before making changes.

Use `local/` for user-specific resumes, generated candidate profiles, preferences, notes, and automation plans. That directory is intentionally ignored by git.

## Checks

From `job-tracker/` run:

```bash
pnpm lint
pnpm build
```
