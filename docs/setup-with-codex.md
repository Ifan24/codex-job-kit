# Set Up With Codex

Use this setup path after cloning the repo.

After cloning the repo, open it in Codex and send:

```text
Set up codex-job-kit for my repository based on docs/setup-with-codex.md.
Read SPEC.md and .codex/skills/codex-job-kit-setup/SKILL.md first.
I have attached my resume. If you cannot see it, ask me for it before creating my candidate profile.
```

Codex should read `SPEC.md` for workflow rules and `.codex/skills/codex-job-kit-setup/SKILL.md` for the setup procedure.

## What Codex Should Do

1. Inspect the clone and confirm the expected files exist.
2. Check Node.js and pnpm availability.
3. Install tracker dependencies with `pnpm install`.
4. Run tracker checks after install: `pnpm lint`, `pnpm build`, and `pnpm smoke-test`.
5. Check whether Browser Use / `browser-use` is available.
6. If the user did not already attach or provide a resume, ask them to upload or provide a resume, CV, LinkedIn export, or profile source before creating `local/candidate-profile.md`.
7. Ask for job-search preferences, dealbreakers, source access, and workflow mode.
8. Create private setup files under `local/`.
9. Configure tracker Settings for sources, workflow rules, document behavior, and candidate defaults.
10. Create `local/prompts/daily-shortlist.md` from the public workflow template.
11. Optionally create `local/prompts/assisted-application.md` from the public assisted-application template.
12. Run command smoke tests against a temporary database.
13. Ask before importing sample data into the real tracker.
14. Propose automations and ask before creating them.

Smoke tests should include `pnpm smoke-test`, which exercises shortlist import/finalization, lane performance, and assisted-application helper commands using fake payloads in `examples/`.

Do not ask before running `pnpm install`, `pnpm lint`, `pnpm build`, or `pnpm smoke-test`; the setup request authorizes those repo-local commands. Still ask before installing missing system tools, importing sample data into the real tracker database, creating automations, or taking externally visible actions.

## User Inputs Codex Should Collect

- preferred name
- city/time zone
- work authorization and constraints
- earliest start date
- target role families
- target seniority or years of experience
- preferred locations and work modes
- salary range or instruction not to filter by salary
- preferred industries/domains
- excluded industries/domains
- hard dealbreakers
- job boards or sources the user can access
- preferred workflow mode: discovery-only, assisted-application, or both
- source priority, including whether easy-apply flows should be used
- whether part-time roles, internships, contract roles, or stretch roles are allowed
- application cadence
- whether to generate cover letters
- whether to suggest resume tailoring

Codex should also explain that assisted applications still require explicit human confirmation before final submit.

## Private Files

Codex should keep user-specific files under ignored paths:

- `local/candidate-profile.md`
- `local/job-search-preferences.md`
- `local/prompts/daily-shortlist.md`
- `local/prompts/assisted-application.md`
- `local/setup-notes.md`
- `job-tracker/data/jobs.db`
- `job-tracker/data/settings.json`
- `job-tracker/storage/`

Do not put private user data into tracked docs, examples, prompts, or source files.

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
Use browser-use for live verification and import only verified roles into the tracker.
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
Use browser-use to screen live listings, fill only factual fields, pause before final submit, and capture manual leads when blocked.
```

The assisted run should produce:

- applied roles, after explicit confirmation
- ready-to-apply manual leads
- skipped or closed roles
- duplicate or already-applied roles
- blockers and exact next actions
