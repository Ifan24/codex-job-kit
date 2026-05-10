# Getting Started

## Ask Codex To Set It Up

After cloning this repo, open it in Codex and say:

```text
Set up codex-job-kit for my repository based on docs/setup-with-codex.md.
Read SPEC.md and .codex/skills/codex-job-kit-setup/SKILL.md first.
I have attached my resume. If you cannot see it, ask me for it before creating my candidate profile.
```

Codex should install dependencies, run checks, ask for your resume and missing preferences, create private files under `local/`, configure the tracker, propose automations, and show the prompt to start your first workflow.

## Requirements

Codex capabilities:

- Browser / `browser-use` for job-board discovery, live listing verification, tracker browser checks, and assisted application forms
- Codex Automations for scheduled runs, if you want recurring workflows

The setup skill is included in this repo; you do not need to install it separately.

Local tools:

- Node.js 20 or newer
- pnpm

Gmail, GitHub, Chrome, and email plugins are not required for the default workflow.

## Install

```bash
cd job-tracker
pnpm install
```

## Test The Tracker

```bash
pnpm smoke-test
pnpm lint
pnpm build
```

`pnpm smoke-test` uses a temporary SQLite database. It does not touch your real tracker data.

## Run The Tracker

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Private Files

Put personal setup files under `local/`. This directory is ignored by git.

Suggested files:

- `local/resume/`: uploaded resume or CV files
- `local/candidate-profile.md`: factual profile distilled from resume and user answers
- `local/job-search-preferences.md`: target roles, locations, work mode, salary, exclusions, and cadence
- `local/prompts/daily-shortlist.md`: personalized discovery prompt
- `local/prompts/assisted-application.md`: personalized apply/capture prompt
- `local/setup-notes.md`: access notes, pending questions, and automation plan

Runtime tracker data is also ignored:

- `job-tracker/data/jobs.db`
- `job-tracker/data/settings.json`
- `job-tracker/storage/`

## Sample Data

Import sample data into the real tracker only when you want fake roles visible in the UI:

```bash
cd job-tracker
pnpm import-shortlist ../examples/shortlists/sample-shortlist.json
```

## Automations

Once your profile and prompts are ready, ask Codex:

```text
Recommend automations for this job-search repo and ask before creating them.
```

Good defaults:

- weekday morning shortlist run
- assisted application session for ready or newly found roles, with final-submit confirmation
- weekday evening application review reminder
- weekly pipeline review and follow-up summary

Codex should confirm the schedule and exact behavior before creating or changing automations.
