---
name: codex-job-kit-setup
description: Set up codex-job-kit for a new user's Codex job-search workflow.
---

# Codex Job Kit Setup

Use this skill when the user asks Codex to set up this repo, configure their job-search workflow, or make codex-job-kit feel like a personalized job-search assistant.

Before setup, read `SPEC.md` and `docs/setup-with-codex.md`. Treat `SPEC.md` as the workflow rules and this skill as the setup procedure.

The goal is to turn a fresh clone into a living local workspace:

- the tracker runs locally
- the user has a private candidate profile in `local/`
- the workflow prompt is customized without committing private data
- assisted application mode is configured if the user wants Codex to help apply or capture leads
- `browser-use` is available for job-board verification
- Codex automations are proposed for the user's preferred cadence
- the repo is ready to evolve as the user's search changes

## Ground Rules

- Do not commit resumes, private candidate profiles, real application history, generated cover letters, browser profiles, cookies, SQLite databases, or local settings.
- Keep user-specific files under `local/`, `job-tracker/data/`, or `job-tracker/storage/`.
- Never ask for passwords. If a job board needs sign-in, ask the user to sign in themselves in the browser.
- Prefer Browser / `browser-use` for browser automation, with Chrome as fallback when Browser is unavailable or cannot access a needed signed-in session.
- Never click a final submit, send, or message action without explicit action-time confirmation from the user.
- Before creating Codex automations, show the exact proposed automations in plain language and ask for confirmation.
- The setup request authorizes repo-local dependency install and checks: `pnpm install`, `pnpm lint`, `pnpm build`, and `pnpm smoke-test`.
- Gmail, GitHub, and email plugins are not required for the default workflow.

## Setup Flow

### 1. Inspect The Clone

Run:

```bash
pwd
git status --short
rg --files -g '!*node_modules*' -g '!*.db' | sed -n '1,120p'
```

Confirm the repo has:

- `SPEC.md`
- `README.md`
- `docs/setup-with-codex.md`
- `job-tracker/`
- `job-tracker/prompts/daily-shortlist-public-template.md`
- `job-tracker/prompts/assisted-application-public-template.md`
- `.codex/skills/job-application-workflow/SKILL.md`
- `WORKFLOW.example.md`
- `APPLICATION_WORKFLOW.example.md`
- `examples/`
- `local/`

If ignored runtime files already exist, leave them alone.

### 2. Check Runtime Access

Run:

```bash
node -v
pnpm -v
```

If Node.js or `pnpm` is missing, ask before installing missing system tools. If both are available, run:

```bash
cd job-tracker
pnpm install
pnpm lint
pnpm build
pnpm smoke-test
```

Do not ask before running the repo-local `pnpm` commands above. The user already asked to set up the repo, and the README documents that setup runs these commands.

### 3. Check Browser Automation

Confirm whether a Browser / `browser-use` skill or plugin is available in Codex. Also check whether Chrome is available as a fallback browser surface.

If it is available:

- read its instructions before browser work
- use it for local tracker QA and future job-board workflows

If it is not available:

- if Chrome is available, tell the user Browser is missing but Chrome can be used as the fallback for live job workflows
- if both Browser and Chrome are missing, tell the user: "This workflow expects Browser / browser-use or Chrome for job-board discovery, live listing verification, tracker browser checks, and assisted application forms."
- ask them to enable/install Browser Use or Chrome in Codex; these are Codex capabilities, not packages this repo can add with `pnpm`
- continue non-browser setup, but do not pretend the daily workflow is fully ready without at least one browser plugin

### 4. Intake The User Profile

Ask the user to upload or provide:

- resume, CV, or LinkedIn export
- optional portfolio, GitHub, personal site, or project notes
- optional example roles they like and roles they do not want

If the initial setup message did not include an attached or pasted resume/profile source, stop here and ask for it before creating `local/candidate-profile.md`. You may still record open setup questions in `local/setup-notes.md`, but do not invent a profile from an empty resume source.

Ask for missing preferences in a compact checklist instead of one long paragraph. Group them like this and mark values inferred from the resume as "assumed, please confirm":

- **Basics:** preferred name, current city/time zone, work authorization, visa constraints, earliest start date.
- **Targets:** role families, seniority or years of experience, locations, remote/hybrid/onsite preference, salary handling.
- **Filters:** preferred industries, excluded industries, must-haves, hard dealbreakers, allowed edge cases such as part-time, internships, contract roles, or stretch roles.
- **Sources:** job boards the user can access, source priority, whether easy-apply flows are allowed.
- **Workflow:** discovery-only, assisted applications, or both; cadence; cover-letter generation; resume tailoring.

When setup is almost complete, ask unresolved preferences as a short numbered list the user can answer inline. Keep the list to the highest-impact missing items first, and avoid asking for facts already available in the resume.

Then create or update:

- `local/candidate-profile.md`
- `local/job-search-preferences.md`
- `local/setup-notes.md`

Use factual, evidence-based language from the user's materials. Mark uncertain details as questions instead of inventing them.

### 5. Configure The Tracker

From `job-tracker/`, create local settings only if needed:

- `JOB_TRACKER_DB_PATH` can stay as `data/jobs.db`
- `JOB_TRACKER_STORAGE_ROOT` can stay as `storage/`
- `JOB_TRACKER_SETTINGS_PATH` can stay as `data/settings.json`

Start the app:

```bash
cd job-tracker
pnpm dev
```

Open the tracker with Browser / `browser-use`, or Chrome fallback when needed, confirm the homepage loads, then open Settings and align:

- source lanes
- candidate defaults
- document options
- workflow toggles

If browser control is unavailable, explain how the user can open `http://localhost:3000` and adjust Settings manually.

### 6. Create The Personalized Workflow Prompt

Copy the public template into a private local prompt:

```bash
mkdir -p local/prompts
cp job-tracker/prompts/daily-shortlist-public-template.md local/prompts/daily-shortlist.md
cp job-tracker/prompts/assisted-application-public-template.md local/prompts/assisted-application.md
cp WORKFLOW.example.md local/WORKFLOW.md
cp APPLICATION_WORKFLOW.example.md local/APPLICATION_WORKFLOW.md
```

Replace placeholders in `local/prompts/daily-shortlist.md` with references to local files and user preferences:

- `<REPO_ROOT>`
- `<TRACKER_ROOT>`
- `<CANDIDATE_PROFILE>`
- `<ROLE_FAMILIES>`
- `<TARGET_LOCATIONS>`
- `<EXPERIENCE_RANGE>`
- `<SEARCH_SOURCES>`

If the user wants assisted application mode, personalize `local/prompts/assisted-application.md` with:

- profile and preferences file paths
- source priority
- allowed easy-apply sources
- allowed part-time, internship, contract, or stretch-role rules
- resume and cover-letter file locations, if the user has provided them
- final-submit confirmation requirement

Keep credentials, browser profiles, and private paths out of tracked files.

### 7. Smoke Test

Run command smoke tests against a temporary tracker state so setup does not pollute the user's real database:

```bash
cd job-tracker
pnpm smoke-test
```

Then, if the user wants sample data in the real tracker UI, ask before running:

```bash
cd job-tracker
pnpm import-shortlist ../examples/shortlists/sample-shortlist.json
pnpm finalize-search-run ../examples/shortlists/sample-run-finalize.json
```

If the user approves the real sample import, refresh the tracker and confirm:

- imported jobs appear
- Workflow Runs loads
- Process Summary appears
- Settings still loads

Tell the user whether sample data was imported into the real tracker or only tested in a temporary DB. If real sample data was imported, explain how to clear `job-tracker/data/jobs.db` if they want a blank tracker.

### 8. Propose Codex Automations

Ask the user whether they want automations. Suggested set:

- Daily or weekday shortlist: run the personalized `local/prompts/daily-shortlist.md`, import verified roles, and summarize what changed.
- Assisted application session: work through ready or newly found roles, fill safe fields, pause before final submit, and capture manual leads when blocked.
- Review reminder: remind the user to open the tracker and submit ready applications.
- Weekly pipeline review: summarize applied, interview, waiting, rejected, and stale roles, then suggest follow-ups.

Show the proposed cadence and behavior before creating anything. Create automations only after the user explicitly confirms.
Tell the user they can review, pause, or edit created automations from Codex's Automations section in the app sidebar.

### 9. Living Repo Habit

At the end, explain that this repo should evolve with the user's search:

- update `local/candidate-profile.md` when the resume changes
- update `local/job-search-preferences.md` when target roles change
- update `local/prompts/daily-shortlist.md` after a bad run
- update `local/prompts/assisted-application.md` after application-flow blockers or source changes
- use tracker Settings for source and workflow tweaks
- keep private data out of git

Finish with:

- what was set up
- tracker URL and whether browser verification passed
- checks that passed
- private files created
- unresolved preferences in a grouped numbered list
- recommended automations, without creating them
- exact next prompt to start the first daily shortlist workflow
- exact next prompt to start the first assisted application session, if enabled
- how to start or adjust automations

Use this shape for the unresolved preference section:

```text
Before the first serious run, please confirm:
1. Basics: work authorization, current city/time zone, earliest start date.
2. Targets: preferred locations/work modes, target seniority, salary handling.
3. Sources: which job boards you can access and whether easy-apply flows are allowed.
4. Workflow: discovery-only or assisted applications too, cadence, cover letters, resume tailoring.
```

Use these next-step prompts when relevant:

```text
Start my first daily shortlist workflow using local/prompts/daily-shortlist.md.
Prefer browser-use for live verification and use Chrome as fallback when needed. Import only verified roles and summarize what changed in the tracker.
```

```text
Start my first assisted application workflow using local/prompts/assisted-application.md.
Read .codex/skills/job-application-workflow/SKILL.md first.
Prefer browser-use for live listings and use Chrome as fallback when needed. Fill only factual fields from my local profile, pause before final submit, and capture manual leads when blocked.
```
