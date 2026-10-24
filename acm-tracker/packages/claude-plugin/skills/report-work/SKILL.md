---
name: report-work
description: Use after completing a meaningful, trackable unit of work (a task or sub-task, a fix, a feature, a deliverable) to report time spent and AI cost to ACM-TRACKER. Triggers when work is billable or worth tracking against a project. Do NOT trigger for trivial chat, clarifying questions, or read-only exploration.
---

# Report work to ACM-TRACKER

When you finish a meaningful unit of work, record it in ACM-TRACKER using the
`report_work` MCP tool so the user has an accurate time + AI-cost ledger.

## When to report

- After completing a task or sub-task that took real effort.
- After delivering a feature, fix, document, or analysis.
- NOT for greetings, clarifying questions, or read-only exploration with no output.
- Report ONCE per unit of work — do not double-count the same effort.

## How to report

Call `report_work` with:

- `projectName` — the project this work belongs to. If unsure, ask the user once,
  then reuse it. Use the same name consistently (case-insensitive match reuses an
  existing project).
- `taskCode` + `taskTitle` — a short code (e.g. `AUTH-12`) and a human title.
- `createMissing: true` — lets the tracker create the project/task on the fly if they
  do not exist yet (idempotent: existing ones are reused, not duplicated).
- `minutes` — your honest estimate of the human-equivalent time for this unit.
- `model`, `tokensIn`, `tokensOut` — the model you used and the tokens consumed, so the
  tracker computes real AI cost (tokens × per-model price). If you don't know exact
  tokens, omit them rather than guessing wildly.

## Conventions

- One project per client/initiative; tasks hang under it.
- Prefer stable `taskCode`s so repeated work on the same task accumulates correctly.
- The tracker is the source of truth for pricing; you only supply model + token counts.

## Verifying

After reporting, you may call `today_summary` or `project_cost` to confirm the entry
landed and show the user the updated cost.
