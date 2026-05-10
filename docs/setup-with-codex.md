# Set Up With Codex

Use this setup path after cloning the repo.

After cloning the repo, open it in Codex and send:

```text
Set up codex-job-kit for my repository based on docs/setup-with-codex.md.
Read SPEC.md and .codex/skills/codex-job-kit-setup/SKILL.md first.
I have attached my resume. If you cannot see it, ask me for it before creating my candidate profile.
```

Codex should read `SPEC.md` for workflow rules and `.codex/skills/codex-job-kit-setup/SKILL.md` for the setup procedure.

## Required Codex Capabilities

The default workflow expects:

- Codex Browser Use / `browser-use` for job-board discovery, live listing verification, tracker browser checks, and assisted application forms.
- Chrome as a fallback for signed-in job-board sessions or sites that do not work well in Browser.
- Documents for editing resume and cover-letter document artifacts.
- PDF for creating, reviewing, and checking resume or cover-letter PDFs.
- Codex Automations for scheduled shortlist runs and weekly pipeline reviews.
- Computer Use only as a last-resort fallback for OS-level actions when Browser and Chrome are unavailable.

The Codex skills are included in this repo. The user does not need to install them separately:

- [setup skill](../.codex/skills/codex-job-kit-setup/SKILL.md)
- [application workflow skill](../.codex/skills/job-application-workflow/SKILL.md)

Gmail, GitHub, and email plugins are not required for the default workflow. Gmail is optional only when the user explicitly wants mailbox status checks later.

If Codex Browser Use / `browser-use` is missing but Chrome is available, configure Chrome as the fallback browser surface for live workflows. If both Codex Browser Use and Chrome are missing, tell the user to install or enable one of them from Codex, continue the non-browser setup, and make clear that live job-board workflows are not ready until a browser capability is available.

## What Codex Should Do

1. Inspect the clone and confirm the expected files exist.
2. Check Node.js and pnpm availability.
3. Install tracker dependencies with `pnpm install`.
4. Run tracker checks after install: `pnpm lint`, `pnpm build`, and `pnpm smoke-test`.
5. Check whether Codex Browser Use / `browser-use`, Chrome, Documents, PDF, and Automations are available.
6. If the user did not already attach or provide a resume, ask them to upload or provide a resume, CV, LinkedIn export, or profile source before creating `local/candidate-profile.md`.
7. Create a private resume workspace under `local/resume/`.
8. Ask for job-search preferences, dealbreakers, source access, and workflow mode.
9. Create private setup files under `local/`.
10. Configure tracker Settings for sources, workflow rules, document behavior, and candidate defaults.
11. Create `local/prompts/daily-shortlist.md` from the public workflow template.
12. Optionally create `local/prompts/assisted-application.md` from the public assisted-application template.
13. Run command smoke tests against a temporary database.
14. Ask before importing sample data into the real tracker.
15. Propose automations and ask before creating them.

Smoke tests should include `pnpm smoke-test`, which exercises shortlist import/finalization, lane performance, and assisted-application helper commands using fake payloads in `examples/`.

Do not ask before running `pnpm install`, `pnpm lint`, `pnpm build`, or `pnpm smoke-test`; the setup request authorizes those repo-local commands. Still ask before installing missing system tools, importing sample data into the real tracker database, creating automations, or taking externally visible actions.

## User Inputs Codex Should Collect

Ask for missing preferences in a compact checklist. Group them like this and mark values inferred from the resume as "assumed, please confirm":

- **Basics:** preferred name, city/time zone, work authorization and constraints, earliest start date.
- **Targets:** role families, seniority or years of experience, preferred locations, work modes, salary handling.
- **Filters:** preferred industries/domains, excluded industries/domains, must-haves, hard dealbreakers, allowed edge cases such as part-time, internships, contract roles, or stretch roles.
- **Sources:** job boards or sources the user can access, source priority, whether easy-apply flows should be used.
- **Workflow:** discovery-only, assisted applications, or both; application cadence; cover-letter generation; resume tailoring.

At the end of setup, ask unresolved preferences as a short numbered list the user can answer inline. Prioritize the highest-impact missing items and avoid asking for facts already available from the resume.

Codex should also explain that assisted applications still require explicit human confirmation before final submit.

## Private Files

Codex should keep user-specific files under ignored paths:

- `local/resume/`
- `local/candidate-profile.md`
- `local/job-search-preferences.md`
- `local/prompts/daily-shortlist.md`
- `local/prompts/assisted-application.md`
- `local/setup-notes.md`
- `job-tracker/data/jobs.db`
- `job-tracker/data/settings.json`
- `job-tracker/storage/`

Do not put private user data into tracked docs, examples, prompts, or source files.

## Resume Workspace

During setup, create `local/resume/` so Codex can find and update resume artifacts later without touching tracked public files.

Recommended shape:

- `local/resume/original/`: uploaded resume, CV, LinkedIn export, or source files
- `local/resume/current-resume.pdf`: current PDF resume when available
- `local/resume/resume.md`: extracted or editable text version for agent review
- `local/resume/notes.md`: tailoring notes, build notes, and open resume questions

If the user provides editable source such as LaTeX, Markdown, DOCX, or a folder of resume files, preserve it under `local/resume/original/` and note how to build or export it in `local/resume/notes.md`. If the user provides only a PDF, keep the PDF and create `local/resume/resume.md` from extracted text so Codex can reason over it. Use Documents/PDF capabilities when available for document editing or PDF verification.

## Automations

Recommended automations:

- weekday morning daily shortlist run
- assisted application session for ready or newly found roles, with final-submit confirmation
- weekday evening application review reminder
- weekly pipeline review and stale follow-up summary

Codex should show the exact automation names, cadence, project, prompt behavior, and expected outputs before creating or changing automations.

Created automations can be reviewed, paused, or edited from Codex's Automations section in the app sidebar.

## First Real Run

After setup, ask Codex:

```text
Run my local daily shortlist workflow from local/prompts/daily-shortlist.md.
Prefer Codex Browser Use / browser-use for live verification and use Chrome as fallback when needed. Import only verified roles into the tracker.
```

The first run should produce:

- recommended roles
- borderline roles
- skipped/excluded roles
- tracker import summary
- cover-letter storage summary, if enabled
- run-quality and next-run adjustment notes

For assisted applications, ask Codex:

```text
Run my local assisted application workflow from local/prompts/assisted-application.md.
Prefer Codex Browser Use / browser-use for live listings and use Chrome as fallback when needed. Fill only factual fields, pause before final submit, and capture manual leads when blocked.
```

The assisted run should produce:

- applied roles, after explicit confirmation
- ready-to-apply manual leads
- skipped or closed roles
- duplicate or already-applied roles
- blockers and exact next actions

## Setup Finish Checklist

Finish setup by reporting:

- tracker URL and whether browser verification passed
- checks that passed
- private files created
- unresolved preferences in a grouped numbered list
- recommended automations, without creating them
- exact next prompt to start the first daily shortlist workflow
- exact next prompt to start the first assisted application session, if enabled

Use this shape for unresolved preferences:

```text
Before the first serious run, please confirm:
1. Basics: work authorization, current city/time zone, earliest start date.
2. Targets: preferred locations/work modes, target seniority, salary handling.
3. Sources: which job boards you can access and whether easy-apply flows are allowed.
4. Workflow: discovery-only or assisted applications too, cadence, cover letters, resume tailoring.
```

Use this prompt to start discovery:

```text
Start my first daily shortlist workflow using local/prompts/daily-shortlist.md.
Prefer Codex Browser Use / browser-use for live verification and use Chrome as fallback when needed. Import only verified roles and summarize what changed in the tracker.
```

Use this prompt to start assisted applications:

```text
Start my first assisted application workflow using local/prompts/assisted-application.md.
Read .codex/skills/job-application-workflow/SKILL.md first.
Prefer Codex Browser Use / browser-use for live listings and use Chrome as fallback when needed. Fill only factual fields from my local profile, pause before final submit, and capture manual leads when blocked.
```
