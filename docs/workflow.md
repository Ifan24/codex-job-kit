# Workflow

This document summarizes the tracker workflows Codex should run after setup.

## Discovery Flow

The public discovery workflow is built around three stages:

1. Harvest and cheap pre-filter job leads with `browser-use`.
2. Batch pre-verify surviving candidates with `pnpm shortlist-batch-verify`.
3. Browser-final verify recommended and borderline roles before import.

Use `WORKFLOW.example.md` for the short workflow and `job-tracker/prompts/daily-shortlist-public-template.md` for the full prompt.

## Assisted Application Flow

Use `APPLICATION_WORKFLOW.example.md` for the short workflow and `job-tracker/prompts/assisted-application-public-template.md` for the full prompt.

The assisted application flow is:

1. Start from tracker roles, a job-board search, or an official company/ATS page.
2. Use `browser-use` to inspect the live listing and application questions.
3. Check duplicates by URL and by title/company before filling forms.
4. Screen for role, seniority, location, work mode, work authorization, compensation, and dealbreakers.
5. Fill only factual fields grounded in the local candidate profile.
6. Pause before final submit and ask the user for action-time confirmation.
7. Record the applied result or capture a `ready_to_apply` manual lead.

The agent should capture a manual lead instead of bypassing login, CAPTCHA, identity, payment, or anti-automation controls.

## Tracker Commands

Check whether a role is already tracked:

```bash
cd job-tracker
pnpm lookup-job --url https://example.com/job
pnpm lookup-job --title "Software Engineer" --company "Example Co"
```

For harvested batches, prefer one centralized lookup pass:

```bash
pnpm lookup-jobs-batch /path/to/harvested-candidates.json
```

Import a shortlist:

```bash
pnpm import-shortlist /path/to/shortlist.json
```

Finalize a workflow run:

```bash
pnpm finalize-search-run /path/to/run-finalize.json
```

Inspect recent lane performance before planning source work:

```bash
pnpm lane-performance --limit 7
```

Store a cover letter:

```bash
pnpm store-cover-letter --job-id 1 --text-file /path/to/cover-letter.txt
```

Assisted application workflows use these helpers for manual leads and application outcomes:

```bash
pnpm capture-lead /path/to/manual-lead.json
pnpm log-application /path/to/application-outcome.json
pnpm update-job-status /path/to/status-update.json
```

They accept a JSON file or `--stdin`. Application and lead payloads may reference an existing tracker job by `jobId`, or provide `canonicalUrl`, `title`, and `company` for a new/upserted job. See `examples/application/` for sample payloads.

Tracker source lanes, candidate defaults, document options, and workflow toggles can be adjusted in the Settings modal. These local settings are stored outside git in `job-tracker/data/settings.json`.

## Safety Rules

- Browser automation uses `browser-use`.
- Mailbox sync is not part of the default workflow.
- Codex must pause before final application submission.
- The Process Summary uses current tracker data and finalized run summaries.
