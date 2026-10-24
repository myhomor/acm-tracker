# ACM-TRACKER — i18n (es/en) + Claude Code Plugin — Design

- **Date:** 2026-06-11
- **Status:** Approved (pending written-spec review)
- **Scope:** Two independent features, one PR each.

## Context

ACM-TRACKER is mature: hexagonal backend, Flight Deck React/Vite front, a versatile
MCP server (`@acm/mcp`, 10 tools) packaged into the desktop app, releases up to v0.1.1.

Two gaps this design closes:

1. **No internationalization.** All UI text is Spanish, hardcoded inline across 26
   `.tsx` files. Project convention is "code in English, UI in Spanish".
2. **No installable connector for end users.** The repo's root `.claude/` holds
   *development* skills/agents (backend-architect, etc.). There is nothing a *user*
   installs to connect *their* agent to the tracker and have it auto-report work.

The two features are independent: separate branches, separate PRs, each through the
existing flow (branch → push → `gh pr create` → CI green → `gh pr merge --squash`).
`main` is protected; the `build-test-e2e` check is required.

## Feature 1 — Internationalization (es/en)

### Decisions

- **Library:** `react-i18next` + `i18next` + `i18next-browser-languagedetector`.
- **Languages:** `es` (default, source of truth) and `en`.
- **Selection:** toggle in **Settings** (preferences section). Persisted in
  `localStorage` under `acm.lang`. Browser-language detection only when no stored value.
- **Layer:** 100% frontend (`apps/web`). No backend, no DB, no hexagonal seam touched.
- **Coverage:** **total** — every screen, shared component, and feature component with
  visible text. Zero hardcoded Spanish UI strings remain.

### File structure (`apps/web/src/i18n/`)

```
i18n/
  index.ts            i18next init: detection order [localStorage, navigator],
                      key 'acm.lang', fallbackLng 'es', supportedLngs ['es','en']
  locales/
    es.json           Spanish catalog (source of truth — current strings, verbatim)
    en.json           English catalog (translations of es.json)
  use-lang.ts         hook { lang, setLang } over i18n.changeLanguage + persistence
```

`i18n/index.ts` is imported once in `main.tsx` before the app renders. Both catalogs
are bundled statically (they are small), so no `Suspense` boundary is required.

### Usage pattern

- Components call `const { t } = useTranslation()` and replace literals with
  `t('namespace.key')`.
- **Namespacing:** per-screen namespaces (`cabina.*`, `projects.*`, `settings.*`, …)
  plus a `common.*` namespace for shared labels (Guardar/Save, Borrar/Delete,
  Cancelar/Cancel, Hoy/Today, Semana/Week, "Sin tarea activa", etc.).
- **Interpolation:** data-bearing text uses `t('mcp.reportedCost', { cost })` →
  `"Costo IA: {{cost}}"`. Number/money formatting keeps the existing helpers; i18n only
  wraps the surrounding text.
- The Settings toggle calls `setLang('es' | 'en')`, which calls
  `i18n.changeLanguage` and writes `localStorage['acm.lang']`.

### Files to migrate (26 — full coverage)

Screens (11): `Auth, Cabina, Costs, Documents, Mcp, Notifications, ProjectDetail,
Projects, Reports, Settings, Tracker`.

Shared components (5): `Chrome, CommandPalette, McpStream, StackedBars` and the
command list in `App.tsx`.

Feature components (10): `documents/ProjectDocuments`, `mcp/McpConnectGuide`,
`mcp/McpEndpointPanel`, `model-pricing/ModelPriceList`, `model-pricing/ModelPriceRow`,
`projects/ProjectEstimatePanel`, `reporting/ProjectMarginPanel`, `reporting/ProjectTeam`,
`time-entries/ProjectTimeline`, `time-entries/TimeEntryModal`.

Migration rule: **the current Spanish string is the source** — copied verbatim into
`es.json`, then translated into `en.json`. No change of meaning, no rewording.

### Process & quality

- Per project rule, edits to `apps/web` are delegated to the `frontend-architect`
  agent and audited by `code-reviewer`.
- Completeness check: after migration, a grep for residual Spanish UI literals in
  `apps/web/src/**/*.tsx` must come back empty (allowing for catalogs and code identifiers).

### Verification

- Build clean.
- **New E2E spec:** switch language to `en` in Settings → reload → a known label renders
  in English; with storage cleared, default is Spanish.
- Existing 19 E2E stay green. Any spec asserting Spanish copy is updated to assert via a
  stable selector or the active-language string.

## Feature 2 — Claude Code Plugin (installable connector)

### Goal

Ship an installable Claude Code plugin so a user can connect their agent to ACM-TRACKER
and have it auto-report time + AI cost — without cloning the repo. The plugin wraps the
**existing** MCP and adds a skill that teaches the agent when/how to report.

### Structure (new `packages/claude-plugin/`)

```
packages/claude-plugin/
  .claude-plugin/
    marketplace.json        single-plugin marketplace (acm-tracker)
    plugin.json             manifest: name, version, description, author
  .mcp.json                 wires @acm/mcp (command + args + env)
  skills/
    report-work/
      SKILL.md              teaches the agent WHEN and HOW to auto-report
  commands/
    acm-status.md           optional /acm-status → today_summary + project_cost
  README.md                 install steps + what it does
  docs/
    other-runtimes.md       Phase 2: report_work as OpenAI function-calling (DOC ONLY)
```

### `.mcp.json` — MCP wiring

Points at the existing `@acm/mcp` server. MCP-entry resolution order:

1. **`ACM_MCP_ENTRY`** env if set (the desktop sidecar already sets this to the packaged
   MCP — reused, not reinvented).
2. **Fallback** to `npx -y @acm/mcp` or the repo's `packages/mcp/dist/index.js`.

Server env: `ACM_API_URL` (default `http://localhost:5188`) and `ACM_OWNER_EMAIL`,
identical to current MCP behavior.

### `skills/report-work/SKILL.md` — the core

Teaches the agent:

- **When** to report: after completing a meaningful task/sub-task — not per message.
- **How:** call `report_work` with `projectName` + `taskCode` + `createMissing` (the
  on-the-fly resolution the MCP already supports), passing real `minutes` and
  `tokensIn / tokensOut / model`.
- **Conventions:** how to name projects/tasks, avoid double-counting time, map the model
  actually used.
- **Frontmatter description** tuned to trigger only for trackable/billable work, per
  skill-authoring best practices.

### Installation (documented in README + product MCP screen)

```
/plugin marketplace add harrinson-gutierrez/acm-tracker
/plugin install acm-tracker@acm-tracker
```

### Boundary preserved

The repo's **root `.claude/`** (development agents/skills) is **not touched**. That is
for *developing* ACM-TRACKER. The new `packages/claude-plugin/` is for *users* connecting
their agent *to* the tracker. The design keeps these two concerns separate.

### Phase 2 (documented, not implemented)

`packages/claude-plugin/docs/other-runtimes.md`: the `report_work` contract expressed as
an OpenAI function-calling schema, so Codex / Ollama / local harnesses can adopt the same
contract later. Documentation only — no code this round.

### Verification

- Validate plugin structure with the plugin-validator (marketplace.json, plugin.json,
  SKILL.md frontmatter, `.mcp.json`).
- Smoke: `marketplace add` reads the marketplace and lists the plugin.
- The MCP itself is already verified e2e (10 tools, report_work cost math) — unchanged.

## Delivery plan

| PR | Branch | Scope | Done = |
|----|--------|-------|--------|
| PR 1 | `feat/i18n-es-en` | Feature 1 — full UI i18n + Settings toggle | build clean, new + 19 E2E green, CI required green, squash |
| PR 2 | `feat/claude-plugin` | Feature 2 — Claude Code plugin + Phase-2 doc | plugin validates, marketplace smoke, CI green, squash |

Recommended order: PR 1 first (mechanical, isolated), then PR 2. They are independent;
order can be swapped without conflict.

## Out of scope (YAGNI)

- Languages beyond es/en.
- Backend/DB-stored language preference (front-only is sufficient for self-host).
- Implemented Codex/local-runtime adapters (Phase 2 is documentation only).
- Touching the root development `.claude/` agents/skills.
- Any change to MCP cost logic or tool surface.
