# Discovery Workflow Example

Copy this workflow to `local/WORKFLOW.md` or `local/prompts/daily-shortlist.md` during setup, then personalize it with the user's candidate profile and preferences.

For apply/capture sessions, use `APPLICATION_WORKFLOW.example.md`.

Full prompt template:

- `job-tracker/prompts/daily-shortlist-public-template.md`

## Summary

1. Read `SPEC.md`, `local/candidate-profile.md`, and `local/job-search-preferences.md`.
2. Use configured sources and `browser-use` for job discovery and live verification.
3. Exclude terminal existing roles through tracker lookup commands.
4. Import verified roles into the tracker.
5. Store cover letters when enabled.
6. Finalize the run with funnel/process-summary data.
7. Report recommend, borderline, skip, duplicate, existing, blocked-source, import, and document sections.

## Required Commands

```bash
cd job-tracker
pnpm lookup-jobs-batch /path/to/harvested-candidates.json
pnpm shortlist-batch-verify /path/to/harvested-candidates.json
pnpm import-shortlist /path/to/shortlist.json
pnpm finalize-search-run /path/to/run-finalize.json
```

Optional document storage:

```bash
pnpm store-cover-letter --job-id JOB_ID --text-file /path/to/cover-letter.txt --pdf-file /path/to/cover-letter.pdf
```

## Safety Rules

- Browser automation uses `browser-use`.
- Mailbox sync is not part of the default workflow.
- The process graph uses tracker run summaries.
