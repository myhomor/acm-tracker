---
description: Show today's ACM-TRACKER summary and, if a project is named, its cost.
argument-hint: "[project-name]"
---

Use the ACM-TRACKER MCP tools to report status.

1. Call `today_summary` and present tracked minutes, billable minutes, and AI cost for today.
2. If the user passed a project name in $ARGUMENTS, call `list_projects` to resolve it,
   then `project_cost` for that project and present human cost, AI cost, total, revenue,
   and margin.
3. Keep the output compact — a short status line, not a wall of JSON.
