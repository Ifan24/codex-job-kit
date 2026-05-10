# Release Checklist

Use this checklist before publishing a repo release.

- Public README explains install, workflow, commands, and privacy expectations.
- `.env.example` exists and does not contain secrets.
- Runtime DB and storage paths are ignored by git.
- Workflow prompts use placeholders, not personal paths.
- Sample data is fake.
- `pnpm lint` passes in `job-tracker/`.
- `pnpm build` passes in `job-tracker/`.
- `pnpm smoke-test` passes in `job-tracker/`.
- A temp-clone install/build smoke check passes before release.
- A private-data audit has no unresolved findings.
- Demo/video artifacts are not committed unless they are intentionally part of a release.
