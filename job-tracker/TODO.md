# Job Tracker TODO

This file tracks the highest-value improvements for the job application workflow.

It should stay practical and operational, not aspirational.

## Current Problems To Fix

### 1. Homepage information architecture is confusing

The current UI mixes:

- source of jobs
- review buckets
- application actions

This creates duplicate concepts such as:

- `Inbox & Queue`
- `Inbox`
- `Review Pools`

The result is that it is not obvious which list the user should actually work from.

### 2. Detail panel placement is inefficient

Right now:

- the user clicks a role lower on the page
- the role details and cover-letter actions are higher up
- the user has to scroll to reach `Open listing`, `Copy text`, and related actions

This is one of the biggest UX pain points.

### 3. Daily workflow reporting is wrong for the new system

The workflow now imports directly into SQLite, so the final answer should not keep showing a pasteable JSON block by default.

The user-facing output should focus on:

- the shortlist
- what was imported
- what was excluded

### 4. Cover-letter flow is incomplete

Not every role needs a cover letter, which is good.

But when a role does need one, the tracker should provide:

- a one-click or one-copy prompt to generate it
- role-specific context already filled in
- a workflow that stores the generated cover letter back into the DB and file storage

## P0: Immediate UX Redesign

### Replace the current homepage structure

Target structure:

- `Today`
- `Apply Next`
- `Review Later`
- `Applied Pipeline`

Avoid showing the same roles in multiple sections on the same screen.

### Make one list the primary working list

The user should have exactly one main active list for unapplied roles.

Possible shape:

- `Apply Next`: recommend + ready-to-apply roles
- `Review Later`: borderline / skip / lower-confidence roles

### Keep action controls beside the selected role

The selected role’s main actions should remain visible without scrolling:

- open listing
- mark ready
- mark applied
- copy cover letter
- generate cover letter prompt

### Reduce duplicate surfaces

Remove or consolidate overlapping sections such as:

- inbox summary plus inbox list plus review pools

The UI should answer:

- what should I apply to now?
- what should I review later?

## P0: Workflow Improvements

### Daily shortlist prompt

- stop showing raw JSON after successful import
- report import summary instead
- keep JSON as an internal artifact unless recovery is needed

### Agent import feedback

The workflow should report:

- created
- updated
- excludedExisting
- blockedSources
- snapshot path

### Agent-run compatibility

The workflow should consistently use:

- `pnpm lookup-job`
- `pnpm import-shortlist`

without needing manual paste into the UI

## P1: Cover Letter Workflow

### Add a generated prompt per job

For each selected job, the tracker should be able to show a copyable prompt that includes:

- company
- title
- platform
- location / work mode
- canonical URL
- fit assessment
- risk note
- legitimacy note
- relevant candidate context from repo instructions

### Separate-session cover-letter generation flow

Desired workflow:

1. user opens a job in the tracker
2. user copies the cover-letter prompt
3. user pastes it into a separate Codex session
4. that session generates the cover letter
5. that session stores:
   - plain text
   - PDF if generated
   - DB linkage to the job

### Cover-letter readiness indicator

Each job should clearly show:

- no cover letter
- prompt ready
- cover letter drafted
- PDF attached

## P1: Better Application Workspace

### Saved answers

Add reusable answers for common forms:

- work authorization
- visa wording
- salary expectation
- earliest start date
- location preference

### Follow-up tracking

Applied roles should support:

- follow-up date
- recruiter contact
- interview stage
- notes

## P2: Longer-Term Improvements

### Better status model

Move toward:

- discovered
- reviewed
- shortlisted
- ready_to_apply
- applied
- interview
- rejected
- closed

### Search-run review page

Add a page for:

- import history
- blocked sources
- duplicates
- already-applied exclusions

### Keyboard-first workflow

Useful shortcuts:

- move selection
- open listing
- mark ready
- mark applied
- copy cover letter

## Suggested Next Implementation Order

1. Redesign homepage into one primary action list plus one secondary review list.
2. Keep the selected role actions visible without scroll.
3. Add copyable cover-letter prompt generation per role.
4. Add cover-letter storage workflow back into the DB/filesystem.
5. Add saved answers and follow-up tracking.
