# PRD: Job Tracker

## Summary

Job Tracker manages a Codex-assisted job-search workflow.

It is designed for a workflow where:

- Codex searches for roles every day
- Codex produces a shortlist with fit and legitimacy notes
- the user applies manually
- the system must remember what has already been applied to

The app is not meant to be a generic CRM. It is a focused execution tool for software-engineering job applications.

## Problem

The current workflow relies too heavily on:

- markdown files as operational state
- git history to infer process
- folders of generated cover letters without indexed metadata

That breaks down as the number of roles grows because:

- duplicate recommendations become harder to prevent
- applied jobs are harder for the agent to exclude reliably
- it becomes harder to know which roles still need action
- generated application artifacts are not easy to find during submission

## Objective

Create a local GUI and storage system that:

1. Keeps a durable record of discovered, shortlisted, and applied roles.
2. Makes it easy for the workflow agent to avoid resurfacing applied jobs.
3. Keeps the user focused on roles that still need action.
4. Makes application artifacts easy to access during submission.

## Not Planned

- Replacing the public portfolio site
- Becoming a general-purpose ATS for every possible hiring workflow
- Automating job applications end to end
- Building a multi-user cloud product

## Primary Users

### Primary user

A job seeker running a local workflow with their own candidate profile, preferred locations, role families, and application constraints.

### Secondary user

Codex workflow agents that need to:

- query already-applied roles
- import daily shortlists
- attach documents and notes
- update state without parsing markdown

## Core Use Cases

### 1. Daily shortlist review

The user opens the app after a search run and sees:

- new roles in an inbox
- recommended roles worth applying to
- borderline roles worth a second look

### 2. Application execution

While applying, the user can:

- open the role page
- copy a cover letter as plain text
- open the PDF version
- see any notes or saved answers
- mark the role as applied

### 3. Duplicate prevention

When a new shortlist is imported, the app can identify:

- exact URL duplicates
- normalized company + title duplicates
- already-applied roles

### 4. Pipeline tracking

Applied roles move out of the main queue and into a pipeline for:

- waiting
- interview
- rejection
- closure

## Product Principles

### 1. Queue first

The homepage should focus on what still needs action.

### 2. Local Storage

The app should work from the repo and SQLite DB on the user's machine.

### 3. Agent-friendly

The workflow agent must be able to query and update the same source of truth.

### 4. Low-friction during application

The app must be useful in the actual moment of applying, not only for record keeping.

## Information Model

Two dimensions must stay separate:

### Recommendation state

- recommend
- borderline
- skip

### Application state

- discovered
- reviewed
- shortlisted
- ready_to_apply
- applied
- interview
- rejected
- closed

This matters because:

- a role can be `recommend` and already `applied`
- a role can be `borderline` but still be worth submitting

## MVP Requirements

### Data

- SQLite source of truth
- persistent job table
- application status table
- review / recommendation table
- documents table
- search run table

### UX

- homepage focused on active queue
- applied roles separated into pipeline
- skipped / closed roles separated into archive
- detail panel for notes, status, and documents
- copyable cover letter text
- PDF access

### Agent support

- import shortlist endpoint
- job lookup endpoint
- already-applied lookup path
- markdown export for backup

## Desired Future Features

### P0

- robust dedupe and applied detection
- import review flow
- queue / pipeline / archive separation
- document readiness indicators

### P1

- saved application answers
- follow-up reminders
- interview stages
- richer shortlist metadata

### P2

- resume variants
- keyboard shortcuts
- richer analytics
- optional sync / cloud export

## Success Criteria

The app is successful if:

1. The workflow agent can reliably exclude already-applied roles.
2. The user can complete daily review and application work faster than with markdown files.
3. Applied roles stop cluttering the active queue.
4. Cover letters and application notes are easier to retrieve during submission.

## Open Design Direction

The UI should feel closer to a task manager or operations console than a metrics dashboard.

That means:

- less empty space above the action area
- fewer oversized summary cards
- more emphasis on queue items and next actions
- clearer separation between current work and historical records
