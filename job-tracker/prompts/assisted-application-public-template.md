# Assisted Application Public Template

Purpose: reusable public workflow template for using Codex and `browser-use` to screen live roles, prepare safe application forms, pause before final submit, and write application outcomes back to `job-tracker`.

## Configuration Inputs

Set these values before running the workflow:

- `<REPO_ROOT>`: absolute path to the cloned codex-job-kit repo
- `<TRACKER_ROOT>`: `<REPO_ROOT>/job-tracker`
- `<CANDIDATE_PROFILE>`: repo-relative path to the user's factual candidate profile
- `<JOB_SEARCH_PREFERENCES>`: repo-relative path to the user's search preferences
- `<RESUME_FILE>`: optional local resume file to upload through normal browser upload controls
- `<COVER_LETTER_POLICY>`: whether to paste text, generate upload files, or skip cover letters
- `<SOURCE_PRIORITY>`: source order, such as company pages, ATS pages, job boards, and easy-apply surfaces
- `<ALLOWED_EDGE_CASES>`: whether part-time, internships, contract roles, or stretch roles are allowed
- `<SIGNED_IN_BROWSER_CDP_URL>`: optional CDP URL for the user's signed-in browser
- `<BROWSER_PROFILE_PATH>`: optional persistent browser profile path

Optional: review tracker Settings before a run so candidate defaults, document behavior, source lanes, and status labels match the current search.

## Objective

Work through ready tracker roles or live job-board/company-page leads, apply when the role is suitable and safe to submit, capture manual leads when a good role is blocked, and update tracker state through the CLI helpers.

This workflow optimizes for useful submitted applications and high-quality manual leads, not exhaustive browsing.

## Core Rules

1. Use `<CANDIDATE_PROFILE>` and `<JOB_SEARCH_PREFERENCES>` as the factual sources of truth.
2. Do not invent credentials, metrics, employment history, work authorization, salary, availability, or application answers.
3. Do not ask the user for passwords.
4. Ask the user to sign in manually when a source requires authentication.
5. Never store cookies, browser profiles, passwords, sessions, or private files in git.
6. Never bypass CAPTCHA, identity, payment, login, or anti-automation controls.
7. Never agree to terms, declarations, or "no AI assistance" statements on the user's behalf.
8. Never click final submit, send, or message without explicit action-time confirmation.
9. Do not paste resume text as a workaround when the form requires a file upload.
10. Use `capture-lead` instead of forcing a brittle or unsafe form.

## Browser Execution Model

Prefer `browser-use`. Use the Chrome plugin as fallback when Browser is unavailable, broken for the target site, or cannot access a needed signed-in session.

Preferred patterns:

1. Cookie-shared isolated worker:
   - main agent connects to `<SIGNED_IN_BROWSER_CDP_URL>`
   - main agent exports fresh cookies for the target source when needed
   - worker uses an isolated `browser-use --session ...` session
   - worker imports cookies and proves signed-in state before applying
2. Single-owner connected-browser worker:
   - assign one worker to control `<SIGNED_IN_BROWSER_CDP_URL>`
   - do not let any other worker or the main agent navigate that browser while the owner is active
   - use this for easy-apply surfaces or sources that do not behave reliably in isolated cookie-shared sessions

Do not use other browser surfaces unless the user explicitly asks for them.

## Source Priority

Use `<SOURCE_PRIORITY>` when present. Otherwise prefer:

1. Official company career pages.
2. ATS-hosted pages linked from the company.
3. Job boards with direct employer postings or easy-apply flows.
4. Professional-network easy-apply flows.
5. Aggregators only as discovery hints when the official posting can be resolved.

When the same role appears in multiple places, use the most official accessible path.

## Screening Before Applying

Before filling anything:

1. Open the live listing.
2. Normalize title, company, platform, canonical URL, location, work mode, employment type, and salary text when visible.
3. Check duplicates:

```bash
cd "<TRACKER_ROOT>"
pnpm lookup-job --url "https://example.com/job"
pnpm lookup-job --title "Software Engineer" --company "Example Co"
```

4. Skip terminal matches with `applied`, `interview`, `rejected`, or `closed`.
5. Read the full description and visible application state.
6. Decide `recommend`, `borderline`, or `skip` with a concise evidence note.

Apply or capture a lead only when the role matches the user's role family, level, location/work mode, work authorization, and dealbreaker rules. Keep part-time, internship, contract, or stretch roles only when `<ALLOWED_EDGE_CASES>` allows them.

## Application Loop

For each suitable role:

1. Open the application flow with `browser-use`, or Chrome when using fallback mode.
2. Read all visible questions before filling.
3. Fill factual fields from `<CANDIDATE_PROFILE>` and `<JOB_SEARCH_PREFERENCES>`.
4. Ask the user when a question needs judgment, sensitive disclosure, or missing information.
5. Upload `<RESUME_FILE>` only through normal browser upload controls.
6. Follow `<COVER_LETTER_POLICY>`:
   - paste concise tailored text when the form has a cover-letter text box
   - generate a file only when upload is required and the user has approved that behavior
   - skip when cover letters are disabled or optional and not useful
7. Replace stale carried-over cover-letter text before continuing.
8. Review the final page for wrong files, stale answers, missing required fields, and mismatched candidate facts.
9. Stop at final submit and ask for explicit confirmation:

```text
At final submit for <role> at <company>. This sends your resume/profile/answers to <company>; reply yes and I will click it.
```

10. If the user confirms and the submission succeeds, log the application.
11. If the user does not confirm, or the page blocks safe automation, capture a manual lead.

## Tracker Commands

After a successful user-confirmed submission:

```bash
cd "<TRACKER_ROOT>"
pnpm log-application /path/to/application-outcome.json
```

The payload may reference an existing tracker `jobId`, or include `canonicalUrl`, `title`, and `company` to create/upsert the job.

For strong roles that need human follow-up:

```bash
cd "<TRACKER_ROOT>"
pnpm capture-lead /path/to/manual-lead.json
```

For pipeline changes:

```bash
cd "<TRACKER_ROOT>"
pnpm update-job-status /path/to/status-update.json
```

Each command also accepts `--stdin`.

## Manual Lead Rules

Capture a manual lead when:

- the role is good but needs account creation, login, CAPTCHA, identity verification, or email/SMS verification
- upload is blocked or unreliable
- the form asks sensitive, subjective, or legally significant questions not covered by local preferences
- the official application path is not reachable
- the user should choose between resume, cover-letter, salary, availability, or disclosure options

Manual lead notes must include:

- why the role is worth pursuing
- why the agent stopped
- exact next human action
- any visible caveat

Use `applicationStatus: "ready_to_apply"` for strong manual leads.

## Final Report

Report:

- submitted applications
- ready-to-apply manual leads
- skipped or closed roles
- duplicate or existing roles
- source switches and blockers
- exact user actions still needed

Keep the report concise. Do not print raw JSON unless the user asks for it or a command failed.
