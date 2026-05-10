# Codex Job Kit Specification

This file defines the tracker workflow, command contracts, data payloads, and safety rules.

## Goals

- Help a user find, verify, shortlist, apply to, and track job applications with a coding agent.
- Keep private candidate data, application history, resumes, and generated artifacts local by default.
- Give the agent stable commands for duplicate checks, shortlist import, document storage, and run finalization.
- Make recurring Codex automations practical without requiring the user to paste JSON or manually reconcile state.
- Let the repository evolve around each user's search while keeping public/shared files reusable.

## Safety Boundaries

- Fully unattended job submission without action-time human confirmation.
- Storing browser credentials, cookies, passwords, or private profiles in git.

## Roles

- **Human user:** owns goals, resume, job preferences, account sign-ins, and final application decisions.
- **Setup agent:** configures the repo, local profile, tracker settings, and automations.
- **Discovery workflow agent:** searches sources, verifies listings, imports shortlists, stores documents, and finalizes run summaries.
- **Assisted application agent:** screens live listings, fills factual application fields, pauses before final submission, and records applied or manual-lead outcomes.
- **Tracker:** local operational source of truth for jobs, applications, documents, and workflow runs.

## Required Local State

Keep user-specific state outside tracked public files.

Recommended private paths:

- `local/candidate-profile.md`: factual profile distilled from the user's resume and answers.
- `local/job-search-preferences.md`: role families, locations, work modes, salary rules, exclusions, and cadence.
- `local/prompts/daily-shortlist.md`: personalized copy of the public workflow prompt.
- `local/prompts/assisted-application.md`: optional personalized assisted-application workflow prompt.
- `local/setup-notes.md`: pending setup questions, access notes, and automation decisions.
- `job-tracker/data/jobs.db`: tracker database.
- `job-tracker/data/settings.json`: tracker settings.
- `job-tracker/storage/`: local imports, cover letters, PDFs, and generated artifacts.

Tracked examples may exist, but they must use fake data.

## Candidate Profile Contract

The setup agent must create or update a factual candidate profile from user-provided materials. It should capture:

- preferred name and location/time zone
- work authorization and constraints
- earliest start date
- education and experience summary
- skills and toolchain
- projects and evidence-backed achievements
- role families and seniority target
- strong-fit signals
- weak-fit or avoid signals
- open questions

The agent must not invent credentials, metrics, employers, projects, or experience.

## Preferences Contract

The setup agent must ask for and store:

- target role families
- target seniority or years-of-experience range
- preferred locations and remote/hybrid/onsite rules
- job boards and sources the user can access
- salary range or instruction not to filter by salary
- preferred industries/domains
- excluded industries/domains
- hard dealbreakers
- application cadence
- preferred workflow mode: discovery-only, assisted-application, or both
- preferred source priority, such as official company pages, ATS pages, job boards, and easy-apply sources
- whether part-time roles, internships, contract roles, or stretch roles are allowed
- whether to generate cover letters
- whether to suggest resume tailoring

Even if the user asks for a fast application loop, final-submit confirmation is always required.

## Browser Automation Contract

The workflow uses `browser-use` for job-board and listing verification.

The agent must:

- use browser automation only after reading the relevant `browser-use` instructions
- ask the user to sign in manually when a source requires authentication
- avoid storing cookies, browser profiles, passwords, or tokens in tracked files
- use browser-final verification for recommended and borderline roles
- confirm that final roles are live, not closed, and do not visibly show already-applied state
- read visible application questions before filling forms
- fill only factual answers grounded in the candidate profile or user-provided preferences
- use normal browser upload controls for private files and pause if upload is blocked or ambiguous
- avoid pasting resume text as a workaround for a required file upload
- review the final page for obviously stale, mismatched, or wrong answers before asking for submit confirmation
- stop before any final submit, send, or external message action and ask for explicit confirmation
- capture a manual lead instead of bypassing CAPTCHA, login, identity, payment, or anti-automation gates

If `browser-use` is unavailable, setup may continue, but job-board workflows will need manual browser work.

## Discovery Workflow

The workflow has three stages:

1. **Harvest and cheap pre-filter:** collect candidate listings from configured sources, remove obvious mismatches, normalize URL/title/company, and run cheap dedupe.
2. **Batch pre-verify:** use scripted checks for sources where HTTP or structured fetches can identify closed, broken, duplicate, or already-tracked roles.
3. **Browser-final verify:** open final recommend/borderline listings in the browser, confirm live state, applied state, source quality, and canonical URL.

The workflow must exclude terminal existing roles with statuses such as `applied`, `interview`, `rejected`, or `closed`.

## Assisted Application Workflow

The assisted application workflow turns verified or newly found roles into applications or manual leads. It should work across official company pages, ATS pages, job boards, and easy-apply surfaces when the user has access.

The workflow should:

1. Read `local/candidate-profile.md`, `local/job-search-preferences.md`, tracker state, and the selected application workflow prompt.
2. Open the configured source with `browser-use` and inspect the live listing, not just the search-card summary.
3. Run tracker duplicate checks by URL and by title/company before investing in an application.
4. Screen for role family, seniority, location/work mode, work authorization, compensation rules, and hard dealbreakers.
5. Prefer official ATS or company pages when the same role appears in multiple places.
6. Fill factual answers from the candidate profile and ask the user when an answer is missing or subjective.
7. Upload resume or cover-letter files only through normal browser upload controls.
8. Review the final page for stale cover-letter text, wrong files, wrong answers, and missing required fields.
9. Stop before final submit and ask the user for action-time confirmation.
10. After the user confirms and the submission succeeds, record the applied outcome in the tracker.
11. If the application is promising but blocked, capture a manual lead with the exact next action.

The agent should skip roles that are clearly closed, already applied, outside the user's target level, incompatible with work authorization, unsafe, or mismatched with explicit dealbreakers. It may keep part-time, internship, contract, or stretch roles only when the user's preferences allow them.

## Manual Lead Capture Contract

A manual lead is a role worth human attention but not safely completed by the agent.

Capture a manual lead when:

- the role looks promising but needs a login, CAPTCHA, identity verification, or account recovery
- file upload is blocked or unreliable
- the application asks sensitive, subjective, or legally significant questions not covered by the candidate profile
- the source is an aggregator and the official path could not be resolved
- the user should choose between multiple resume, cover-letter, salary, or availability options

Each manual lead should include:

- canonical URL, title, company, platform, location, and work mode when known
- recommended bucket: `recommend` or `borderline`
- reason it is worth pursuing
- reason the agent stopped
- exact next action for the human
- current application status, usually `ready_to_apply`

## Tracker Command Contract

The tracker provides these commands:

```bash
pnpm lookup-job --url URL
pnpm lookup-job --title "TITLE" --company "COMPANY"
pnpm lookup-jobs-batch FILE_OR_--stdin
pnpm shortlist-batch-verify FILE_OR_--stdin
pnpm import-shortlist FILE_OR_--stdin
pnpm store-cover-letter --job-id ID --text-file PATH [--pdf-file PATH]
pnpm finalize-search-run FILE_OR_--stdin
```

Each command is responsible for one tracker operation:

- look up existing jobs before recommending them
- batch-check harvested candidates
- import verified shortlist payloads
- store generated documents against job IDs
- finalize a run with funnel/process summary data

Assisted application workflows use these commands:

```bash
pnpm capture-lead FILE_OR_--stdin
pnpm log-application FILE_OR_--stdin
pnpm update-job-status FILE_OR_--stdin
```

These operations may be separate scripts, UI actions, or a shared status-update command. They should preserve the same responsibilities:

- capture promising roles that need human follow-up
- record successful submissions with source, timestamp, and notes
- update status without rewriting unrelated job data

## Shortlist Payload Contract

An imported shortlist should include:

- `searchedAt`
- `promptVersion`
- `platforms`
- `summary`
- `blockedSources`
- `jobs`

Each job should include, where known:

- `canonicalUrl`
- `title`
- `company`
- `platform`
- `location`
- `workMode`
- `employmentType`
- `salaryText`
- `sourceQuality`
- `descriptionSummary`
- `bucket`: `recommend`, `borderline`, or `skip`
- `fitAssessment`
- `riskNote`
- `legitimacyNote`

The importer should reject or exclude duplicate terminal roles, broken listings, closed postings, and unresolved aggregator entries from the active recommendation queue.

## Application Outcome Contract

Application workflows should record one of these outcomes:

- `applied`: submitted after explicit human confirmation
- `ready_to_apply`: promising manual lead that needs human action
- `not_started`: tracked but not yet actionable
- `skipped`: reviewed and intentionally not pursued
- `closed`: live page shows the role is no longer available

Each applied or manual-lead outcome should include a short evidence note explaining what the agent saw and what changed.

## Run Finalization Contract

Each workflow run should produce a durable summary that can power a process graph. Include:

- `runId`
- `promptVersion`
- `runQuality`
- `promptUpdated`
- `funnel`
- `laneReviews`
- `workflowIssues`
- `nextRunAdjustments`
- `coverLetterSummary`

The `funnel` should capture counts such as:

- raw harvested
- unique after cheap dedupe
- batch preverified
- batch excluded
- live pages verified
- terminal duplicates excluded
- imported recommend/borderline/skip counts

## UI Contract

The tracker UI should expose:

- active jobs grouped by next action
- application statuses
- job detail view with listing links and document actions
- Settings for sources, candidate defaults, document behavior, and workflow toggles
- Workflow Runs history
- Process Summary graph using current DB data
- manual leads or ready-to-apply queue
- Timeline or activity history

The UI should optimize for repeated daily use, not marketing presentation.

## Automation Contract

Codex automations should be proposed, not silently created.

Recommended automations:

- daily or weekday shortlist run
- assisted application session for ready or newly found roles, with final-submit confirmation
- application review reminder
- weekly pipeline review and stale follow-up summary

Before creating automations, the agent must show:

- name
- cadence
- project/workspace
- prompt behavior
- expected outputs
- whether it writes tracker state

## Privacy And Safety

Implementations must not commit:

- real resumes, cover letters, transcripts, or application answers
- real application history or SQLite databases
- local tracker settings
- browser profiles, cookies, sessions, passwords, or tokens
- private workflow prompts with personal paths or candidate details

The agent must ask before:

- installing dependencies
- creating automations
- importing sample data into the real tracker
- submitting applications or sending messages
- uploading private files to third-party services

The agent must never:

- click a final submit/send button without explicit action-time confirmation
- agree to terms, declarations, or "no AI assistance" statements on the user's behalf
- bypass CAPTCHA, identity, payment, or anti-automation controls
- invent application answers to keep an automated flow moving

## Reference Implementation

This repository includes:

- `job-tracker/`: Next.js + SQLite tracker and CLI commands
- `job-tracker/prompts/daily-shortlist-public-template.md`: public workflow template
- `job-tracker/prompts/assisted-application-public-template.md`: public assisted-application workflow template
- `WORKFLOW.example.md`: discovery workflow example
- `APPLICATION_WORKFLOW.example.md`: assisted application workflow example
- `.codex/skills/codex-job-kit-setup/SKILL.md`: Codex setup procedure
- `docs/setup-with-codex.md`: human-facing setup guide
- `examples/`: fake profile and sample import payloads

Use these files as the working setup for the tracker and Codex workflows.
