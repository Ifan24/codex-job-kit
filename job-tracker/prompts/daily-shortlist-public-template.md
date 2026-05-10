# Daily Shortlist Public Template

Purpose: reusable public workflow template for discovering jobs, verifying listings with Codex Browser Use / `browser-use`, importing into `job-tracker`, storing cover letters, and finalizing run data.

## Configuration Inputs

Set these values before running the workflow:

- `<REPO_ROOT>`: absolute path to the cloned codex-job-kit repo
- `<TRACKER_ROOT>`: `<REPO_ROOT>/job-tracker`
- `<CANDIDATE_PROFILE>`: repo-relative path to the user's candidate profile
- `<ROLE_FAMILIES>`: preferred role families, such as software engineer, backend engineer, full-stack engineer, or AI engineer
- `<TARGET_LOCATIONS>`: preferred locations and remote/hybrid rules
- `<EXPERIENCE_RANGE>`: target seniority or years-of-experience range
- `<SEARCH_SOURCES>`: enabled boards, company pages, and ATS sources
- `<SIGNED_IN_BROWSER_CDP_URL>`: optional CDP URL for the user's signed-in browser
- `<BROWSER_PROFILE_PATH>`: optional persistent browser profile path

Optional: review or update the tracker Settings modal before a run so source lanes, candidate defaults, document preferences, and workflow toggles match the current search.

Optional lane performance source:

```bash
cd "<TRACKER_ROOT>"
pnpm lane-performance --limit 7
```

Use recent lane performance to rank configured lanes, identify stale or unexplored lanes, and decide expansion waves.

## Objective

Search for fresh job leads, filter them against candidate fit and already-tracked history, import the verified shortlist into `job-tracker`, generate and store cover letters for final recommended roles, then finalize the run with process-summary data.

## Core Rules

1. Do not invent job details.
2. Only use information visible on the listing page, board page, or official company page.
3. Do not overstate candidate fit.
4. Use `<CANDIDATE_PROFILE>` as the factual source of truth.
5. Use `<ROLE_FAMILIES>`, `<TARGET_LOCATIONS>`, and `<EXPERIENCE_RANGE>` as configurable filters.
6. Exclude terminal tracker matches with `applied`, `interview`, `rejected`, or `closed` status.
7. Do not use mailbox, calendar, or plugin-backed communication workflows unless the user explicitly adds them.

## Browser Execution Model

Prefer Codex Browser Use / `browser-use`. Use the Chrome plugin as fallback when Browser is unavailable, broken for the target site, or cannot access a needed signed-in session.

Preferred patterns:

1. Cookie-shared isolated worker:
   - main agent connects to `<SIGNED_IN_BROWSER_CDP_URL>`
   - main agent exports fresh cookies for the target source when needed
   - worker uses an isolated `browser-use --session ...` session
   - worker imports cookies and proves signed-in state before scouting
2. Single-owner connected-browser worker:
   - assign one worker to control `<SIGNED_IN_BROWSER_CDP_URL>`
   - do not let any other worker or the main agent navigate that browser while the owner is active
   - use this for sources that do not behave reliably in isolated cookie-shared sessions

Do not use other browser surfaces unless the user explicitly asks for them.

## Three-Stage Search Flow

### Stage 1: Harvest and Cheap Pre-Filter

- Assign distinct lanes for configured sources and search phrases.
- Inspect enough result pages to avoid judging a lane from the first visible screen only.
- Capture title, company, platform, stable posting URL, location/work mode, and a short fit note.
- Drop obvious mismatches, expired listings, training-data work, low-trust reposts, unsupported locations, and unresolved aggregator loops.
- Run cheap dedupe by exact URL and normalized title plus company.
- The main agent then runs tracker checks centrally. For a batch, prefer:

```bash
cd "<TRACKER_ROOT>"
pnpm lookup-jobs-batch /path/to/harvested-candidates.json
```

For one-off checks, use:

```bash
cd "<TRACKER_ROOT>"
pnpm lookup-job --url "https://example.com/job"
pnpm lookup-job --title "Software Engineer" --company "Example Co"
```

### Stage 2: Batch Pre-Verification

Write surviving candidates to a temporary JSON file and run:

```bash
cd "<TRACKER_ROOT>"
pnpm shortlist-batch-verify /path/to/harvested-candidates.json
```

Use this step for ATS, direct company pages, and sources where HTTP/scripted checks can identify closed or broken listings. Treat board applied-state checks and ambiguous client-rendered pages as browser-final work.

### Stage 3: Browser-Final Verification and Ranking

- Open the actual posting page for every final `recommend` or `borderline` role.
- Confirm the role is live, not closed, and does not show an already-applied state.
- Prefer official ATS or direct company URLs as canonical when available.
- Do not import unresolved aggregator URLs as final recommended roles.

## Tracker Import Contract

Build a JSON payload and import it directly:

```bash
cd "<TRACKER_ROOT>"
pnpm import-shortlist /path/to/shortlist.json
```

The payload should include `searchedAt`, `promptVersion`, `platforms`, `summary`, `blockedSources`, and final `jobs` with `canonicalUrl`, `title`, `company`, `platform`, `location`, `workMode`, `employmentType`, `salaryText`, `sourceQuality`, `descriptionSummary`, `bucket`, `fitAssessment`, `riskNote`, and `legitimacyNote`.

Do not include duplicates, terminal existing roles, broken listings, closed postings, or unresolved aggregator entries.

## Cover-Letter Storage

For each imported `recommend` role that was created or updated, generate a factual plain-text cover letter and PDF when tooling is available. Store artifacts with:

```bash
cd "<TRACKER_ROOT>"
pnpm store-cover-letter --job-id JOB_ID --text-file "/path/to/cover-letter.txt" --pdf-file "/path/to/cover-letter.pdf"
```

If PDF generation is unavailable, store the text version and report the omission.

## Finalize Run

After import and cover-letter storage, finalize the run:

```bash
cd "<TRACKER_ROOT>"
pnpm finalize-search-run /path/to/run-finalize.json
```

The finalize payload should include:

- `runId`
- `promptVersion`
- `runQuality`
- `promptUpdated`
- `funnel`
- `laneReviews`
- `workflowIssues`
- `nextRunAdjustments`
- `coverLetterSummary`

The `funnel` object should record counts such as raw harvested, unique after cheap dedupe, batch preverified, batch excluded, live pages verified, terminal duplicates excluded, and imported recommend/borderline/skip counts.

Each `laneReviews` item should include the lane name and, when known, `source`, `laneId`, `wave`, `finishedCleanly`, `authStatus`, `rawCandidates`, `stableUrlsCaptured`, `candidatesReturned`, `recommendCount`, `borderlineCount`, `terminalDuplicateCount`, `blockedCount`, `blockedSources`, and notes. These fields power `pnpm lane-performance`.

## Final Report

Report:

- recommended, borderline, skipped, duplicate, existing, and blocked-source sections
- tracker import summary
- cover-letter generation/storage summary
- run quality and next-run adjustments

Do not print raw JSON if the import succeeded unless the user explicitly asks for it.
