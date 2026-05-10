---
name: job-application-workflow
description: Use when the user asks Codex to find, screen, apply to, or capture job leads from job boards, easy-apply flows, official company pages, or ATS pages using Browser / browser-use with Chrome fallback and the local codex-job-kit tracker.
---

# Job Application Workflow

Use this skill when the user asks Codex to run an assisted application session, apply to roles, work through ready tracker jobs, capture manual leads, or operate job-board, easy-apply, company-page, or ATS application flows.

This skill is generic. It must use the user's private local profile and preferences, not hard-coded candidate facts.

## Required Tools

- Prefer Browser / `browser-use` for browser interaction.
- Read the Browser / `browser-use` instructions before the first browser action in a turn.
- Use the Chrome plugin as the fallback when Browser is unavailable, broken for the target site, or cannot access a needed signed-in session.
- Before the first Chrome action in a turn, read the Chrome skill instructions and use the user's existing Chrome profile/session only when relevant.
- Use local shell commands for tracker lookup, status updates, and payload validation.
- Do not require Gmail, GitHub, or email plugins for the default workflow.
- Do not fall back to Computer Use unless Browser and Chrome are unavailable, or the user explicitly asks for it.

If Browser / `browser-use` is unavailable but Chrome is available, continue in Chrome and note the fallback. If neither Browser nor Chrome is available, explain that live job-board verification and application forms are blocked. Continue only with non-browser tracker work, such as reviewing local ready-to-apply jobs or preparing payloads.

## Sources Of Truth

Read these before a non-trivial application session:

- `SPEC.md`
- `AGENTS.md`
- `local/candidate-profile.md`
- `local/job-search-preferences.md`
- `local/prompts/assisted-application.md` when it exists
- `job-tracker/data/settings.json` when it exists
- tracker state through `job-tracker` lookup/status commands

If `local/candidate-profile.md` or `local/job-search-preferences.md` is missing, stop and ask the user to run setup first:

```text
Set up codex-job-kit for my repository based on docs/setup-with-codex.md.
Read SPEC.md and .codex/skills/codex-job-kit-setup/SKILL.md first.
```

## Candidate Defaults

Use only facts present in the local candidate profile, search preferences, resume, or explicit user messages.

- Do not invent work authorization, salary, notice period, years of experience, location, credentials, security clearance, background checks, licenses, or availability.
- If a form asks a question that is not covered by local facts or explicit preferences, pause and ask the user.
- Treat values marked "assumed, please confirm" as unresolved until the user confirms them.
- Use the selected resume or local resume path only when it is clearly configured.
- Do not paste resume text as a workaround for a required file upload.
- Upload private files only through normal browser upload controls.
- Keep all private files, generated answers, cookies, sessions, and browser profiles out of git.

## Screening Rules

Before filling an application:

1. Inspect the live listing, not only the search-card summary.
2. Normalize title, company, platform, canonical URL, location, work mode, employment type, and salary text when visible.
3. Check duplicates in the tracker:

```bash
cd job-tracker
pnpm lookup-job --url "<canonical-url>"
pnpm lookup-job --title "<title>" --company "<company>"
```

4. Skip terminal matches with statuses such as `applied`, `interview`, `rejected`, or `closed`.
5. Screen the role against `local/job-search-preferences.md`.
6. Decide `recommend`, `borderline`, or `skip` with a concise evidence note.

Apply or capture a lead only when the role matches the user's role family, seniority, location/work mode, work authorization, salary rules, and dealbreakers. Part-time, internship, contract, or stretch roles are allowed only when the user's local preferences allow them.

Skip or capture as manual-only when a role:

- is closed, already applied, duplicated, or inaccessible
- violates a hard preference or legal/work-authorization requirement
- asks the applicant to agree that no AI assistance was used
- requires CAPTCHA, account creation, password-manager action, payment, identity verification, or other unsafe automation
- is recruiter-only, aggregator-only, vague, low-trust, unpaid, training-data-only, or outside the user's chosen work categories

## Source Priority

Use `local/job-search-preferences.md` and tracker Settings when present. Otherwise prefer:

1. Official company career pages.
2. ATS-hosted pages linked from the company.
3. Job boards with direct employer postings or easy-apply flows.
4. Professional-network easy-apply flows.
5. Aggregators only as discovery hints when an official posting can be resolved.

When the same role appears in multiple places, use the most official accessible path.

## Application Loop

For each suitable role:

1. Open the listing or application flow with Browser / `browser-use`, or Chrome when using fallback mode.
2. Read the full listing and all visible questions before filling.
3. Fill only factual fields grounded in local profile/preferences.
4. Ask the user when a question needs judgment, sensitive disclosure, or a missing preference.
5. Use configured resume and cover-letter behavior from local preferences.
6. Replace stale carried-over cover-letter text before continuing.
7. Review the final page for wrong files, stale text, wrong answers, and missing required fields.
8. Stop at final submit and ask for explicit action-time confirmation:

```text
At final submit for <role> at <company>. This sends your resume/profile/answers to <company>; reply yes and I will click it.
```

9. If the user confirms and submission succeeds, log the application.
10. If the user does not confirm or the page blocks safe automation, capture a manual lead.

Prior "continue", "autopilot", or "always allow submit" messages do not override the final-submit confirmation requirement.

## Continuous Session Mode

When the user asks to keep going, continue the search, or run an application session:

- move from one suitable role to the next without stopping for ordinary status updates
- keep updates short: applied roles, hard skips, source switches, and blockers
- capture good blocked roles as manual leads instead of ending the session
- stop when the user asks, the source is exhausted, browser access is blocked, or remaining roles are hard skips
- still pause before every final submit action

## Manual Lead Capture

Capture a manual lead when a role is promising but the agent should not submit it directly.

Common reasons:

- login, account creation, CAPTCHA, identity, email/SMS verification, or payment gate
- blocked or unreliable file upload
- subjective or sensitive questions not covered by local preferences
- official application path cannot be reached
- user should choose between resume, cover-letter, salary, availability, or disclosure options

Use:

```bash
cd job-tracker
pnpm capture-lead /path/to/manual-lead.json
```

Manual lead notes should include:

- why the role is worth pursuing
- why Codex stopped
- exact next human action
- caveats such as seniority stretch, eligibility uncertainty, salary unknown, or source blocked

Use `applicationStatus: "ready_to_apply"` for strong manual leads.

## Tracker Logging

After a user-confirmed successful submission:

```bash
cd job-tracker
pnpm log-application /path/to/application-outcome.json
```

For status changes:

```bash
cd job-tracker
pnpm update-job-status /path/to/status-update.json
```

Commands accept JSON files or `--stdin`. Prefer tracker commands over direct SQLite edits.

## Final Report

Keep the final report concise:

- submitted applications
- ready-to-apply manual leads
- skipped, closed, duplicate, or already-applied roles
- source switches and blockers
- exact user actions still needed
- tracker commands that succeeded or failed

Do not print raw JSON unless the user asks for it or a command failed.
