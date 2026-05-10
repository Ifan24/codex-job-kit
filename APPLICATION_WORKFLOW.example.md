# Assisted Application Workflow Example

Copy this workflow to `local/APPLICATION_WORKFLOW.md` or `local/prompts/assisted-application.md` during setup, then personalize it with the user's profile, job preferences, and source access.

Use this alongside `WORKFLOW.example.md`: discovery finds and imports good roles; assisted application turns suitable roles into submitted applications or manual leads.

Full prompt template:

- `job-tracker/prompts/assisted-application-public-template.md`

## Summary

1. Read `SPEC.md`, `local/candidate-profile.md`, `local/job-search-preferences.md`, and tracker state.
2. Use Codex Browser Use / `browser-use` to inspect live listings and application pages, with Chrome fallback when needed.
3. Check duplicates before filling any application.
4. Screen each role against the user's role, seniority, location, work-mode, salary, authorization, and dealbreaker rules.
5. Fill only factual answers grounded in the candidate profile or explicit user preferences.
6. Stop before final submit and ask the user for action-time confirmation.
7. Record successful submissions or capture manual leads in the tracker.
8. Report applied, ready-to-apply, skipped, closed, duplicate, blocked, and follow-up sections.

## Source Priority

Prefer sources in this order unless the user's local preferences say otherwise:

1. Official company career pages.
2. ATS-hosted job pages linked from the company.
3. Job boards with direct employer postings or easy-apply flows.
4. Professional-network easy-apply flows.
5. Aggregators only when the official posting can be resolved or the source is trusted by the user.

When the same role appears in multiple places, use the most official path that is still accessible.

## Screening Rules

Apply or capture a lead when:

- the role family matches the user's target roles
- seniority and years-of-experience expectations are within range or explicitly allowed as a stretch
- location, remote/hybrid/onsite expectations, and work authorization look compatible
- the listing is live and does not visibly show already-applied state
- the work is legitimate engineering, product, data, AI, design, operations, or another user-approved field

Skip when:

- the role is closed, duplicated, already applied, or recruiter/aggregator-only with no usable source
- the seniority, work authorization, location, or work mode is a hard mismatch
- the listing is mainly unpaid work, training-data piecework, speculative freelance gig work, or another excluded category
- the flow asks the agent to bypass anti-automation, identity, payment, or password controls
- the application requires agreeing that no AI assistance was used

Part-time roles, internships, contract roles, or stretch roles are allowed only when the user's local preferences explicitly allow them.

## Application Loop

For each promising role:

1. Open the listing or application page with Codex Browser Use / `browser-use`, or Chrome fallback when needed.
2. Normalize title, company, platform, canonical URL, location, and work mode.
3. Run duplicate lookup by URL and by title/company.
4. Read the full listing and application questions.
5. Decide `recommend`, `borderline`, or `skip` with a short evidence note.
6. If applying, fill factual fields from the candidate profile.
7. Upload resume or cover-letter files only through normal browser upload controls.
8. Do not paste resume text as a workaround for a required file upload.
9. Replace stale carried-over cover-letter text before continuing.
10. Review the final page for wrong files, stale answers, and missing required fields.
11. Pause at the final submit step and ask the user to confirm the exact action.
12. If the user confirms and the submission succeeds, log the application.
13. If the user does not confirm or the page blocks safe automation, capture a manual lead.

Do not keep retrying a brittle form indefinitely. Preserve momentum by capturing the lead, noting the blocker, and moving on.

## Manual Lead Capture

Capture a manual lead when the role looks worth pursuing but the agent should not complete it alone.

Include:

- title, company, canonical URL, source, location, and work mode
- bucket: `recommend` or `borderline`
- why it is a good fit
- why the agent stopped
- exact human next action
- suggested status, usually `ready_to_apply`

Example status note:

```text
Ready to apply: good backend/platform fit. Agent stopped because the form requires account verification before resume upload. Human next action: sign in, upload resume, review answers, and submit.
```

## Tracker Operations

Use the implemented tracker commands when available:

```bash
cd job-tracker
pnpm lookup-job --url URL
pnpm lookup-job --title "TITLE" --company "COMPANY"
pnpm store-cover-letter --job-id JOB_ID --text-file /path/to/cover-letter.txt --pdf-file /path/to/cover-letter.pdf
```

The tracker provides application-state helpers:

```bash
pnpm capture-lead /path/to/manual-lead.json
pnpm log-application /path/to/application-outcome.json
pnpm update-job-status /path/to/status-update.json
```

They accept a JSON file or `--stdin`. Application and lead payloads may reference an existing tracker job by `jobId`, or provide `canonicalUrl`, `title`, and `company` for a new/upserted job.

## Safety Boundaries

- Never click final submit, send, or message without explicit action-time confirmation.
- Never ask the user for passwords.
- Never store cookies, sessions, browser profiles, or credentials in git.
- Never bypass CAPTCHA, login, identity, payment, or anti-automation controls.
- Never invent facts, answers, metrics, employers, credentials, visa status, salary expectations, or availability.
- Ask when the form needs judgment, sensitive disclosure, or a preference the user has not provided.

## Safety Rules

- Browser automation prefers Codex Browser Use / `browser-use`, with Chrome fallback when needed.
- Mailbox sync is not part of the default workflow.
- Codex must pause before final submission.
- Application logging and manual lead capture should go through tracker helpers or equivalent UI actions.
