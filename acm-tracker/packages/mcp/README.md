# @acm/mcp — ACM-TRACKER MCP server

An [MCP](https://modelcontextprotocol.io) server (stdio transport) that lets agents — Claude Code, Claude Desktop, etc. — report work to ACM-TRACKER. The agent decides when to call `report_work`; the server computes the **real AI cost** (tokens × model price) and records a time entry under the task.

It is a thin adapter over the ACM-TRACKER REST API (`POST /api/mcp/report-work`), so the cost logic stays in the backend.

## Tools

| Tool | Reads/Writes | Purpose |
| --- | --- | --- |
| `list_projects` | read | List projects (id, name, client, contract, status). |
| `create_project` | write | Create a project. |
| `list_tasks` | read | List a project's tasks (id, code, title, phase, status). |
| `create_task` | write | Create a task in a project. |
| `report_work` | write | Record minutes + AI usage on a task → real AI cost + time entry. Identify the task by `taskId`, **or** by `projectName` + `taskCode` (with `createMissing: true` to create them on the fly). |
| `project_cost` | read | Real cost breakdown of a project (human, AI, hours, contract). |
| `today_summary` | read | Today's tracked time + cost. |
| `recent_reports` | read | The most recent MCP-ingested work reports. |
| `list_model_prices` | read | The AI model price table. |
| `set_model_price` | write | Add or update a model's price (USD per 1M tokens) — needed for AI cost. |

**Frictionless flow:** the agent can just call `report_work` with `projectName` + `taskCode` + `createMissing: true` — no need to look up ids first; the project/task are created if missing. (The explicit flow `list_projects` → `list_tasks` → `report_work` still works.)

## Setup

1. Build it (from the repo root):

   ```bash
   pnpm --filter @acm/mcp build
   ```

2. Make sure ACM-TRACKER is running — the desktop app, or the self-hosted API. The server talks to it over HTTP (default `http://localhost:5188`).

3. Register it with Claude Code. Add to your Claude config (see `claude-config.example.json`):

   ```json
   {
     "mcpServers": {
       "acm-tracker": {
         "command": "node",
         "args": ["/absolute/path/to/acm-tracker/packages/mcp/dist/index.js"],
         "env": {
           "ACM_API_URL": "http://localhost:5188",
           "ACM_OWNER_EMAIL": "owner@acm.local"
         }
       }
     }
   }
   ```

4. Restart Claude Code. It will discover the three tools. Now you can say things like *"register 45 minutes on task T-142, I used opus with 1240 in / 980 out tokens for PR #318"* and Claude will call `report_work` itself.

## Environment

| Var | Default | Meaning |
| --- | --- | --- |
| `ACM_API_URL` | `http://localhost:5188` | Base URL of the ACM-TRACKER API. |
| `ACM_OWNER_EMAIL` | `owner@acm.local` | The member the work is attributed to (single-user / NoAuth mode). |

## Note on AI cost

`report_work` returns `$0.00` for a model that has no row in the **model prices** table. Add the model's price in ACM-TRACKER (Settings → pricing, or `POST /api/model-prices`) so the server can compute `tokens × price`.
