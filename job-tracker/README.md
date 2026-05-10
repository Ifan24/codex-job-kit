# Codex Job Tracker

Job Tracker is the web app and CLI backend for this repo.

Use it to:

- store discovered jobs in SQLite
- review recommended and borderline roles
- track application status
- store cover-letter files
- keep applied, rejected, skipped, and closed roles out of future recommendations
- give Codex stable commands for lookup, import, application logging, and run summaries

## Quick Start

```bash
pnpm install
pnpm smoke-test
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
pnpm lint
pnpm build
pnpm smoke-test
```

`pnpm smoke-test` uses a temporary database and fake example payloads.

## Common Commands

```bash
pnpm lookup-job --url https://example.com/job
pnpm lookup-job --title "Software Engineer" --company "Example Co"
pnpm lookup-jobs-batch ../examples/shortlists/sample-shortlist.json
pnpm import-shortlist ../examples/shortlists/sample-shortlist.json
pnpm finalize-search-run ../examples/shortlists/sample-run-finalize.json
pnpm lane-performance --limit 7
pnpm capture-lead ../examples/application/manual-lead.json
pnpm log-application ../examples/application/application-outcome.json
pnpm update-job-status ../examples/application/status-update.json
pnpm store-cover-letter --job-id 1 --text-file /path/to/cover-letter.txt
```

Most JSON commands also accept `--stdin`.

## Data Paths

By default:

- SQLite DB: `data/jobs.db`
- settings: `data/settings.json`
- generated/imported files: `storage/`

These paths are ignored by git.

Optional environment overrides:

```bash
cp .env.example .env.local
```

- `JOB_TRACKER_DB_PATH`
- `JOB_TRACKER_STORAGE_ROOT`
- `JOB_TRACKER_SETTINGS_PATH`

## Agent Handoff

Codex should use the CLI commands instead of editing SQLite directly.

Discovery flow:

1. `pnpm lookup-jobs-batch` for harvested candidates.
2. `pnpm shortlist-batch-verify` for candidates that can be checked without a browser.
3. `pnpm import-shortlist` for verified roles.
4. `pnpm finalize-search-run` after import and document storage.
5. `pnpm lane-performance --limit 7` before planning the next run.

Application flow:

1. `pnpm lookup-job` before filling a form.
2. `pnpm capture-lead` when a good role needs human follow-up.
3. `pnpm log-application` after a user-confirmed submission succeeds.
4. `pnpm update-job-status` for pipeline changes.

Legacy migrations are explicit commands and do not run on startup:

```bash
pnpm import-applied-jobs-md /path/to/applied_jobs.md
pnpm import-legacy-cover-letters /path/to/cover_letters
```
