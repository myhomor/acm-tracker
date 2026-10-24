# Other runtimes (Phase 2 — documentation only)

The Claude Code plugin wraps the ACM-TRACKER MCP server. Other agent runtimes can adopt
the same `report_work` contract directly. This is documentation only — no adapter is
shipped yet.

## report_work as an OpenAI function-calling schema

```json
{
  "type": "function",
  "function": {
    "name": "report_work",
    "description": "Report time and AI cost for a unit of work to ACM-TRACKER.",
    "parameters": {
      "type": "object",
      "properties": {
        "projectName": { "type": "string" },
        "taskCode": { "type": "string" },
        "taskTitle": { "type": "string" },
        "createMissing": { "type": "boolean" },
        "minutes": { "type": "number" },
        "model": { "type": "string" },
        "tokensIn": { "type": "integer" },
        "tokensOut": { "type": "integer" }
      },
      "required": ["projectName", "taskCode", "minutes"]
    }
  }
}
```

A runtime maps a tool call to `POST {ACM_API_URL}/api/mcp/report-work`. Codex CLI and
local OpenAI-compatible harnesses (Ollama, llama.cpp) can register this function and
forward calls to that endpoint.
