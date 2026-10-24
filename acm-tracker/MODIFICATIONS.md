# Modifications

This directory is a modified copy of [ACM-TRACKER](https://github.com/harrinson-gutierrez/acm-tracker)
by Harrinson Gutierrez Coronado, licensed under AGPL-3.0 (see `LICENSE`).

- Base: upstream commit `0e95c8a` (main, version 0.3.0, 2026-06-12).
- Modified: 2026-10-24 — 2026-10-25.

## What was changed

- **Task statuses** `waiting` and `hold` (API validation, shared types) and a status column with the git branch
  in the project task list.
- **Task summary**: new nullable `Task.summary` column (Postgres and SQLite migrations
  `20261024120000_add_task_summary`), shown under the task title.
- **Time entries**: notes and member name in the project and today timelines; "Who" column and human/auto source
  labels on the Time screen; local server time instead of UTC in the Time and MCP feeds.
- **Yesterday block** on the Time screen and `GET /time-entries/day?date=YYYY-MM-DD`.
- **My hourly rate** setting in Settings → Preferences (owner rate); seed default rate 0.
- **AI cost in estimates**: AI cost included in project cost (`/projects/:id/cost`, MCP `project_cost`),
  per-person costs, the weekly report and the Reports tiles; project margin computed against total cost.
- **Daily report** `GET /reports/daily` (human / agent / waiting minutes per day with tasks), project filter
  for the weekly and per-person reports, project selector and a "By day" panel on the Reports screen.
- Removed the hard-coded "Plataforma fintech" subtitle from the project header.
- Tests updated for the new fields; new tests for project AI cost, daily grouping and local date helpers.
