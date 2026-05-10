# Privacy And Data

Keep job-search data on your machine and out of git.

Do not commit:

- `job-tracker/data/jobs.db`
- `job-tracker/data/settings.json`
- files under `job-tracker/storage/`
- files under `local/`
- real resumes, transcripts, cover letters, or application answers
- browser profiles, exported cookies, or session files
- private workflow prompts with personal paths or candidate details

For assisted applications, Codex should pause before final submit, send, or message actions and ask for explicit confirmation. It should capture a manual lead instead of bypassing login, CAPTCHA, identity, payment, or anti-automation controls.

Before publishing a fork, run a text audit for names, emails, absolute paths, credentials, and private locations.
