# ACM-TRACKER — Claude Code plugin

Connect your agent to ACM-TRACKER so it auto-reports time and AI cost.

## Prerequisites

- ACM-TRACKER running and reachable (default `http://localhost:5188`). Open the desktop
  app or run the Docker image first.
- Node.js available on PATH.

## Install

```
/plugin marketplace add harrinson-gutierrez/acm-tracker
/plugin install acm-tracker@acm-tracker
```

The MCP server ships pre-bundled inside the plugin (`mcp/`), so it works straight from
the marketplace with no extra build step. Restart Claude Code after installing so the
`acm-tracker` MCP server and the `report-work` skill load.

> Maintainers only: to regenerate the bundle after changing `@acm/mcp`, run
> `pnpm --filter @acm/claude-plugin bundle` and commit the updated `mcp/`.

## Configure (optional)

Set env vars before launching your agent to override defaults:

- `ACM_API_URL` — tracker API base (default `http://localhost:5188`)
- `ACM_OWNER_EMAIL` — owner email (default `owner@acm.local`)

## What you get

- MCP server `acm-tracker` with 10 tools (list/create projects & tasks, `report_work`,
  `project_cost`, `today_summary`, `recent_reports`, model pricing).
- Skill `report-work` that teaches the agent when/how to report.
- Command `/acm-status` for a quick today summary.

## Other runtimes

See `docs/other-runtimes.md` for the `report_work` contract as an OpenAI
function-calling schema (Codex / local models — Phase 2, documentation only).
