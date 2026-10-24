# ACM-TRACKER

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE) [![Commercial license available](https://img.shields.io/badge/Commercial%20license-available-F44E5C.svg)](./COMMERCIAL-LICENSE.md)

Self-hosted **time + cost tracker**. The single source of truth for what work really costs — human time (rate × time) **plus AI cost** (tokens × model price, reported by agents via MCP). Local app, remote database, no per-seat cost.

> **Status:** v1 + v2 functional and verified by E2E (21/21). UI faithful to the "Flight Deck" design. Real AI cost via MCP. UI in English (default) and Spanish, switchable in Settings → Preferences.

![Dashboard](docs/screenshots/app-01-cabina.png)

---

## Table of contents

- [What it is](#what-it-is)
- [Stack and architecture](#stack-and-architecture)
- [How to run it](#how-to-run-it)
- [Screens and features](#screens-and-features) ← **complete inventory**
- [REST API (endpoints)](#rest-api-endpoints)
- [Data model](#data-model)
- [Tests (unit + E2E)](#tests-unit--e2e)
- [Engineering conventions](#engineering-conventions)
- [Workflow (PR)](#workflow-pr)
- [Roadmap](#roadmap)
- [Internal docs](#internal-docs)
- [License](#license)

---

## What it is

Replaces the Jira + Clockify combo with a single self-hosted tool where:

- **Time and cost live together**, per person and per project.
- Cost is the real cost: `time × rate` (human) **+ tokens × model price** (AI).
- An **MCP server** lets agents (Claude Code, etc.) report work, time, and tokens directly — AI cost is calculated using the price table and reconciled with human time on the same line.
- **Integrations are notifications only** — this app is the source of truth, not another platform to sync with.
- **Self-hosted**, remote database, no per-seat cost. Pluggable auth (starts with no auth, local owner).

Sample project in the seeded data: **Helios · Fintech platform**.

---

## Stack and architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, **TanStack Query** (server state) + **Zustand** (UI state) |
| Backend | NestJS 10 — **Hexagonal** (ports & adapters), SOLID, RESTful |
| Shared | `@acm/shared` — types + pure cost helpers (CommonJS) |
| ORM | Prisma 5 |
| DB | **Remote Postgres** (via `DATABASE_URL`) — not bundled |
| Auth | Pluggable `AuthProvider`; v1 = `NoAuthProvider` (local owner). Cognito pluggable later |
| Tests | Jest (api) · Vitest (shared) · **Playwright** (E2E web) |
| Run | `docker compose up` (web + api; remote DB) |

**Monorepo (pnpm workspaces):**

```
acm-tracker/
├── apps/
│   ├── api/   # NestJS hexagonal (domain/application/infrastructure/interfaces per module)
│   └── web/   # React + Vite (reusable components / features / screens) + e2e (Playwright)
├── packages/
│   └── shared/  # types + cost helpers (computeEntryCost, sumCost, aiCostFromUsage, breakdownCost)
├── docs/
│   ├── plans/        # implementation plans (v1, v2, UI fidelity) — source of truth for tasks
│   ├── design/       # reference Figma frames (01..13)
│   └── screenshots/  # real app screenshots
├── docker-compose.yml
└── CLAUDE.md         # engineering contract (mandatory rules)
```

**Hexagonal backend** — each feature in `apps/api/src/modules/<feature>/`:
- `domain/ports/` — interfaces + Symbol token (domain has no knowledge of Prisma or Nest)
- `application/use-cases/` — one use case = one class with a single `execute()`
- `infrastructure/persistence/` — Prisma adapter + mapper (the only place Prisma is used)
- `interfaces/http/` — thin controller + DTOs

**Reactive frontend** — `apps/web/src/`:
- `components/` — reusable presentational components (no data fetching): Chrome (sidebar+topbar), Panel, RingGauge, DonutGauge, StackedBars, StatTile, TileRow, Avatar, Tag, PersonCostRow, McpStream, TimerDock, DataTable, SideNav, CommandPalette
- `features/<feature>/api/` — TanStack Query hooks (with invalidation → UI refreshes automatically)
- `screens/` — compose features + components; `App.tsx` handles routes only

---

## How to run it

> **Two DB backends.** Postgres is the **source of truth** for the schema; SQLite is a "lite" mirror for single-user mode. Selected via `DB_BACKEND` (`sqlite` by default · `postgres`). Details in [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md#db-backends-postgres-source-of-truth-sqlite-mirror).

### Solo mode (SQLite, single user)

No Postgres, no Docker. A single command starts api + web on a local SQLite file (`file:./acm.db`, under `apps/api/prisma/sqlite/`):

```bash
pnpm install
pnpm dev:solo
# migrate the SQLite set + seed (owner + Helios project) and start:
# web  → http://localhost:5173
# api  → http://localhost:4000/api
```

`dev:solo` sets `DB_BACKEND=sqlite` and `DATABASE_URL=file:./acm.db`, runs `db:bootstrap` (idempotent SQLite migration + seed) and then `pnpm dev`. The seed is idempotent: re-running it will not duplicate data. To migrate/seed without starting anything: `pnpm --filter @acm/api db:bootstrap`.

`DB_BACKEND=sqlite` is the **default** for the distribution: any startup without DB variables uses local SQLite.

### With Docker (one command)

```bash
cp .env.example .env        # set DATABASE_URL to your remote Postgres
docker compose up --build
# web  → http://localhost:5173
# api  → http://localhost:4000/api
```
Migrations run automatically when the `api` container starts.

> There is an optional `docker-compose.override.yml` (gitignored) that starts a local Postgres for testing.

### Install / Self-host (single image)

A single image with web + api + SQLite, no external dependencies. The api serves the front's static build at `/` and the API at `/api` (single-origin, no CORS). Data persists in a volume mounted at `/data` (DB `file:/data/acm.db` and files at `/data/uploads`).

```bash
docker run -p 5173:5173 -v acm-data:/data ghcr.io/harrinson-gutierrez/acm-tracker:latest
# app → http://localhost:5173   ·   api → http://localhost:5173/api
```

The entrypoint runs `db:bootstrap` (idempotent migrate + seed SQLite) on every startup and then serves the app. Restarting the container preserves the data in the `acm-data` volume.

To build the image locally:

```bash
docker build -t acm-tracker .                 # Dockerfile at root (multi-stage)
docker compose -f docker-compose.single.yml up --build   # or via compose, with acm-data volume
```

The 2-service mode (`docker-compose.yml`, separate web + api on Postgres) remains the "team" option; the single image is the "solo" option.

### Cloud 1-click

Deploy the GHCR image with managed Postgres + persistent disk:

- **Render** — use [`render.yaml`](render.yaml) (Blueprint): creates the web service (GHCR image) + a managed Postgres + disk at `/data`. New → Blueprint → point to this repo.
- **Railway** — use [`railway.json`](railway.json): build from the `Dockerfile`, healthcheck at `/api/projects`. Add a Postgres plugin and link `DATABASE_URL` + `DB_BACKEND=postgres`.

### Kubernetes (Helm)

Chart at [`charts/acm-tracker`](charts/acm-tracker). Reuses the GHCR image.

```bash
# Solo mode (SQLite on a PersistentVolume — 1 replica):
helm install acm ./charts/acm-tracker

# Team mode (external Postgres — scalable):
helm install acm ./charts/acm-tracker \
  --set db.backend=postgres \
  --set db.postgres.url="postgresql://USER:PASS@HOST:5432/acm_tracker"
# or with an existing Secret:
#   --set db.postgres.urlSecret.name=acm-db --set db.postgres.urlSecret.key=databaseUrl

# Expose with Ingress:
helm install acm ./charts/acm-tracker \
  --set ingress.enabled=true --set ingress.host=acm.example.com
```

Key values in [`values.yaml`](charts/acm-tracker/values.yaml): `db.backend` (sqlite|postgres), `persistence` (PVC for `/data`), `ingress`, `resources`, `cors.origin`. With `db.backend=sqlite` keep `replicaCount: 1` (single volume); for HA use `postgres`.

### Desktop app (Tauri)

Native window (no Docker, no terminal): Tauri starts the **NestJS api as a sidecar** (a Node process running `dist/src/main.js`) pointed at a SQLite database in the OS data directory (`%APPDATA%\com.acmtracker.desktop` on Windows, `~/Library/Application Support/...` on macOS, `~/.local/share/...` on Linux). The single-origin static front is served by the api itself; the window loads `http://127.0.0.1:5188/`. On first launch, it runs migrate + seed (idempotent) against that database.

```bash
# Dev (requires Node + Rust/cargo). Assembles the payload (web+api+shared build) and launches the window:
pnpm --filter @acm/desktop dev

# Local installer build (NSIS/MSI · DMG · AppImage/deb):
pnpm --filter @acm/desktop build
```

The sidecar uses the **system Node** (`node` on PATH): pragmatic for getting it working today; see the embedded Node / SEA follow-up below. Signed installers come from CI: the [`.github/workflows/desktop.yml`](.github/workflows/desktop.yml) workflow compiles for `windows-latest`/`macos-latest`/`ubuntu-latest` on push of a `desktop-v*` tag (or manually via `workflow_dispatch`) and attaches them to a **GitHub Release (draft)**. **Code-signing** (Authenticode on Windows, notarization on macOS) and the auto-updater remain as documented TODOs in the workflow — they require paid certificates.

### Without Docker, on Postgres (development)

```bash
pnpm install
cd apps/api && cp ../../.env.example .env   # DB_BACKEND=postgres + DATABASE_URL postgres
DB_BACKEND=postgres pnpm prisma migrate dev && pnpm seed   # owner + Helios project
cd ../.. && DB_BACKEND=postgres pnpm dev                    # api + web in parallel
```

### Environment variables (`.env`)

```
# DB backend: "sqlite" (default, solo mode) or "postgres"
DB_BACKEND=sqlite
# SQLite: optional, default file:./acm.db. Postgres: required.
DATABASE_URL="file:./acm.db"
# DB_BACKEND=postgres → DATABASE_URL="postgresql://USER:PASS@HOST:5432/acm_tracker?schema=public"
API_PORT=4000
WEB_PORT=5173
OWNER_NAME="Harry G."
OWNER_EMAIL="owner@acm.local"
OWNER_RATE_PER_HOUR=45
# CORS: only the 2-service mode needs this (web and api on different origins).
# Without CORS_ORIGIN, CORS is not enabled (single-origin, single image). Accepts "*" or a comma-separated list.
# CORS_ORIGIN=http://localhost:5173
# WEB_DIST_DIR: if set, the api serves that static front build (single-origin). The single image sets it to /repo/apps/web/dist.
# UPLOADS_DIR: uploaded files folder. Local default apps/api/uploads; in the single image /data/uploads.
```

---

## Screens and features

Navigation is via **icon sidebar** (persistent, left) + **⌘K / Ctrl+K** (command palette). Dark "Flight Deck" theme: ring gauges, technical grid, JetBrains Mono for data.

### 1. Dashboard (`/`)
![Dashboard](docs/screenshots/app-01-cabina.png)
- **Today's burn rate**: ring gauge with the day's cost vs the editable daily target (Settings → Preferences), Human/AI breakdown.
- **Team · real cost today**: each person with their tracked time and cost (real data from `/reports/team-today`).
- **MCP · live intake**: stream of reports received from agents (empty until an agent reports).
- **Tiles**: Today (tracked), Week, Billable, Margin.
- **Timer dock** (global, visible on every screen): tap ▶ on a task row or use the project→task picker to start a real timer; the dock shows live elapsed time; STOP logs the entry automatically. "+ log time" still opens the **manual log entry modal** (project→task→minutes→billable→save).
- Responsive: collapses to a single column on mobile.

### 2. Projects (`/projects`)
![Projects](docs/screenshots/app-08-proyectos.png)
- Project list with client and contract amount.
- **Create project** (input + Enter or "+ Create").
- Click a project → detail view.

### 3. Project detail (`/projects/:id`)
- Header: avatar + name + contract + label.
- **Functional in-page tabs**: Summary / Tasks / Time / Costs / Team / Documents.
- **Cumulative real cost**: large figure, % consumed vs contract, Human/AI/Hours breakdown (real, from `/projects/:id/cost`).
- **Tasks · time + cost**: table with code, title, real time, cost per task, and **"+ time"** (opens the log modal with the task pre-selected).
- **Create task** (input + "+ Task").
- **Time**: real timeline of time entries for the project (date/time · task · person · minutes · cost), from `/time-entries/project/:id`.
- **Team**: who logged time on the project with hours + human/AI/total cost, from `/reports/by-person?projectId=`.
- **Documents**: documents scoped to the project (created with `projectId`), from `/documents?projectId=`.

![Project · Time](docs/screenshots/app-10-proyecto-tiempo.png)
![Project · Team](docs/screenshots/app-11-proyecto-equipo.png)

### 4. Costs & AI (`/costs`)
![Costs](docs/screenshots/app-02-costos.png)
- Tiles: Projects, Human, AI ($0 until reported via MCP), Models with price.
- **Cost composition** (Human/AI donut).
- **AI · cost by model**: price table (from `/model-prices`).

### 5. Reports (`/reports`)
![Reports](docs/screenshots/app-03-reportes.png)
- 5 KPIs calculated from real data: Hours, Total cost, AI cost, avg $/hour, People.
- **Time+cost by week**: stacked human/AI bars (from `/reports/weekly`).
- **By person · real cost**: table (from `/reports/by-person`).
- **Export CSV** (downloads `cost-by-person.csv`).

### 6. Time tracker (`/tracker`)
![Tracker](docs/screenshots/app-04-tracker.png)
- Day tiles: Tracked, Billable, Cost today, From AI.
- **Timeline**: today's entries with time, origin (tag `manual`/`mcp`/`timer`), task, duration, cost (from `/time-entries/today`).
- **Day target**: progress vs 8h.
- **Timer dock** (global, visible on every screen): tap ▶ on a task row or use the project→task picker to start a real timer; the dock shows live elapsed time; STOP logs the entry automatically. "+ log time" still opens the **manual log entry modal**.

### 7. MCP server (`/mcp`)
![MCP](docs/screenshots/app-05-mcp.png)
- **Endpoint** of the MCP server.
- **`report_work()` contract**: the payload an agent sends.
- **Received reports**: live stream (poll every 5s) of what agents have reported — person, task, time, cost, model→$.
- Functional: `POST /api/mcp/report-work` creates a time entry (origin=mcp) + ai_runs and **calculates the real AI cost** (tokens × model price).

### 8. Documents (`/documents`)
![Documents](docs/screenshots/app-06-documentos.png)
- **Spaces + phases sidebar** (Sales/Kickoff/Quote/Prototype/Validation/Execution/Delivery) that **truly filters the list**.
- **Create document** (title + optional URL → type page/link; inherits the selected phase).
- Hybrid table: icon by type, phase (tag), created by, date, **Delete**.

### 9. Settings (`/settings`)
![Settings](docs/screenshots/app-07-settings.png)
- **SideNav**: Members & rates / Model prices (scrollable), MCP & tokens / Notifications (navigate).
- **Members & rates**: table with avatar, role, $/h rate, status.
- **Model prices** (source of truth for AI cost): USD/1M tokens table with per-row **create** (form) and **delete**.
- **Authentication provider**: current mode (no auth · local owner).

### 10. Notifications (`/notifications`)
- Banner: "outgoing notifications only — ACM-TRACKER is the source of truth".
- Channels: Slack/Email/WhatsApp/Webhook.
- **Alert rules**: table with **create** (event/condition/channel), **toggle** enable/disable (functional), **delete**.

### 11. Auth · sign-in (`/auth`)
![Auth](docs/screenshots/app-09-auth.png)
- Split: brand panel with gauge + login form.
- **Functional login**: validates email against members (`/auth/login`) → enters the dashboard. No-auth mode (local owner).

### 12. Command palette (⌘K / Ctrl+K)
- Global overlay with navigation actions to all sections.

---

## REST API (endpoints)

Base: `http://localhost:4000/api` · all protected by `AuthGuard` (in NoAuth mode resolves to local owner).

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PATCH | `/members` | members + rates |
| GET/POST/GET:id/PATCH | `/projects` `/projects/:id` | projects (with tasks in :id) |
| GET/POST/PATCH | `/tasks?projectId=` | tasks by project |
| POST/GET | `/time-entries` `/time-entries/task/:id` | log/read time |
| GET | `/time-entries/task/:id/cost` | cost of a task |
| GET | `/time-entries/today` | today's entries (timeline) |
| GET/POST/PATCH/DELETE | `/model-prices` | model prices (CRUD) |
| GET | `/projects/:id/cost` | human/AI/total breakdown for the project |
| GET | `/reports/by-person` · `/reports/weekly` | aggregations |
| GET | `/reports/today` · `/reports/team-today` | day summary / team today |
| GET/POST/DELETE | `/documents?projectId=` | documents (CRUD) |
| GET/POST/PATCH/DELETE | `/notification-rules` | notification rules (CRUD + toggle) |
| POST/GET | `/mcp/report-work` · `/mcp/reports` | **MCP intake** (calculates AI cost) + reports |
| POST | `/auth/login` · `/auth/me` | login (validates member) / owner |

### Example: reporting work from an agent (MCP)

```bash
curl -X POST http://localhost:4000/api/mcp/report-work -H "Content-Type: application/json" -d '{
  "taskId": "<task-id>",
  "memberEmail": "owner@acm.local",
  "minutes": 45,
  "output": "PR #318 preToken",
  "aiRuns": [{ "model": "claude-opus-4-8", "tokensIn": 1240, "tokensOut": 980 }]
}'
# → { "recorded": true, "aiCost": 0.09 }   (1240/1M×$15 + 980/1M×$75)
```

### Connecting an agent with the Claude Code plugin

```
/plugin marketplace add harrinson-gutierrez/acm-tracker
/plugin install acm-tracker@acm-tracker
```

Restart Claude Code afterwards so the `acm-tracker` MCP server and the `report-work`
skill load. The MCP server ships pre-bundled inside the plugin, so it installs straight
from GitHub with no build step. The plugin gives your agent 10 MCP tools (list/create
projects & tasks, `report_work`, `project_cost`, `today_summary`, `recent_reports`,
model pricing), the `report-work` skill that teaches it when/how to report, and an
`/acm-status` command.

The MCP talks to a running ACM-TRACKER over HTTP — keep the app open while using it. It
targets `http://localhost:5188` (the desktop app) by default; point it elsewhere (e.g. a
dev stack on `:4000`) by setting `ACM_API_URL` before launching your agent:

```bash
ACM_API_URL=http://localhost:4000 claude
```

See `packages/claude-plugin/README.md` for details and the `report_work` contract.

---

## Data model

Prisma tables (Postgres): `Member`, `Project`, `Task`, `TimeEntry` (with `origin: manual|mcp`), `AiRun` (tokens + cost, linked to TimeEntry), `ModelPrice`, `Document`, `NotificationRule`, `WorkspaceSettings`.

- **Human cost** = `minutes/60 × ratePerHourSnapshot` (rate is frozen at entry creation time).
- **AI cost** = Σ per `AiRun` of `(tokensIn/1M × inputPer1M) + (tokensOut/1M × outputPer1M)`.
- Pure helpers in `@acm/shared`: `computeEntryCost`, `sumCost`, `aiCostFromUsage`, `breakdownCost`.

---

## Tests (unit + E2E)

```bash
# unit (shared + api)
pnpm --filter @acm/shared test     # cost helpers
pnpm --filter @acm/api test        # use cases (hexagonal, port fakes)

# E2E (requires stack running on :5173 / :4000)
pnpm --filter @acm/web e2e         # Playwright — 21 tests
```

The api unit tests use in-memory port fakes, so they are **backend-agnostic**: they pass identically under `DB_BACKEND=sqlite` (default) and `DB_BACKEND=postgres`. To verify both locally:

```bash
DB_BACKEND=sqlite   pnpm --filter @acm/api test    # 15/15
DB_BACKEND=postgres pnpm --filter @acm/api test    # 15/15
```

The schema drift-check (Postgres source ↔ SQLite mirror) runs with `pnpm --filter @acm/api db:drift-check` and must pass in CI. If CI needs to cover e2e on both backends, the natural approach is a `DB_BACKEND ∈ {sqlite, postgres}` matrix (sqlite with no services; postgres with the throwaway `docker-compose.override.yml`).

The E2E suite (`apps/web/e2e/`) **asserts real behavior** for every screen: sidebar + ⌘K navigation, project→task→time→cost ($45) flow, CRUD for projects/tasks/documents/prices/rules, rule toggle, login, CSV export, project tabs, document phase filter, settings nav, and **MCP report_work → AI cost $0.09**.

```
19 passed
```

---

## Engineering conventions

Mandatory rules in [`CLAUDE.md`](CLAUDE.md), [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md), [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md):
- SOLID, hexagonal (backend), reactive + decoupled components (frontend).
- Reuse-before-create, zero-comment, short functions, RESTful (≤2 nesting levels).
- Specialized agents in `.claude/agents/` (backend-architect, frontend-architect, db-schema-guardian, code-reviewer) and skills in `.claude/skills/`.

---

## Workflow (PR)

`main` is **protected**: no direct push allowed. All changes go through a Pull Request.

```bash
git checkout -b feat/my-change
# ... changes + tests ...
git push -u origin feat/my-change
gh pr create --fill            # open PR
# review, then merge (squash recommended)
gh pr merge --squash
```

---

## Roadmap

**Done (v1 + v2 + UI fidelity):**
- ✅ Time+cost core (auth scaffold, projects, tasks, time entries, cost = time×rate).
- ✅ Costs & AI: model price table, reports (by person, weekly), day aggregations.
- ✅ Functional MCP server (`report_work` → real AI cost) + screen.
- ✅ Documents (CRUD + phase filter), Notifications (CRUD + toggle), Auth login.
- ✅ 13 screens faithful to the Flight Deck design + navigation + ⌘K + responsive.
- ✅ E2E suite (21 tests).
- ✅ Internationalization (English default + Spanish), toggle in Settings → Preferences, persisted.
- ✅ Installable Claude Code plugin (`packages/claude-plugin`) — pre-bundled MCP (10 tools) + `report-work` skill + `/acm-status` command, installs straight from GitHub.

**Next:**
- ✅ **Real live timer** — backend `TimerSession` (one per member, auto-stop & log on task switch), global fixed dock on every screen, play button per task.
- ✅ **Real MCP server** (`packages/mcp`, stdio) — Claude Code and other agents discover the `report_work`/`list_projects`/`list_tasks` tools and report work+tokens; the server calculates real AI cost. See [packages/mcp/README.md](packages/mcp/README.md). *(Remote HTTP/SSE transport = future, for team mode.)*
- ⏳ **Real Cognito auth** (plug in the `AuthProvider`) + workspace invitations.
- ⏳ **Documents**: real file upload (storage), pages with editor, production cost per doc.
- ✅ **Margin and budget** — editable daily cost target, real AI fraction in the burn gauge, week tile, global margin tile, live MCP stream on the cockpit.
- ⏳ **Notifications**: real delivery to channels (Slack/email/webhook).
- ⏳ **Export**: client report PDF and invoice.
- ⏳ CI (GitHub Actions): build + unit + E2E on every PR.
- ⏳ Production deployment (real remote DB + domain).
- ⏳ **Single-user mode on local SQLite** (`file:./acm.db`, no Postgres, no `docker compose`) — Postgres remains the source of truth for the schema; SQLite is a "lite" mirror adapter, selectable via `DB_BACKEND`. Details and tasks in the [v1 plan addendum](docs/plans/2026-06-05-acm-tracker-v1-local.md#addendum--2026-06-09--single-user-mode-on-local-sqlite).

**Installable (4 formats, critical path — [packaging plan](docs/plans/2026-06-09-acm-tracker-packaging-installable.md)):**
- ✅ **Self-host in 1 command**: single image (web+api+SQLite, single-origin) with `docker run -p 5173:5173 -v acm-data:/data …`; the release workflow publishes multi-arch to GHCR on `v*` tag. *(Missing: `docker build`/`run` smoke test on a host with Docker and the first release tag.)*
- ✅ **PWA**: installable from the browser (manifest + service worker autoUpdate, Flight Deck icons 192/512/maskable). The SW caches only the app-shell; `/api` is never cached (data always live).
- ✅ **Desktop app** (Tauri): native window, NestJS sidecar + SQLite in OS app-data, single-origin. `.exe`/`.msi`/`.dmg`/`.AppImage`/`.deb` installers built by CI (`desktop.yml`) on `desktop-v*` tag. *(Missing: code-signing — paid certificates — and smoke test of the first CI installer launch.)*
- ✅ **Cloud one-click / Helm**: `render.yaml` + `railway.json` (1-click with managed Postgres) and Helm chart (`charts/acm-tracker`, sqlite or postgres, PVC, ingress) — reuse the GHCR image.

---

## Internal docs

- [Implementation plans](docs/plans/) — v1, v2 (costs/AI), UI Figma fidelity (each task, immutable).
- [Reference Figma design](docs/design/) — the 13 frames.
- [Real screenshots](docs/screenshots/) — the app in action.

---

## License

ACM-TRACKER is distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** — see [`LICENSE`](./LICENSE).

- **Free self-hosting:** use it, modify it, and share it freely for yourself, your team, or your company.
- **Network copyleft:** if you offer a **modified** version to third parties **over a network**, you must publish your code under AGPL-3.0.
- **Need closed SaaS or embedding in a proprietary product?** A **commercial license** is available (dual-licensing) that lifts the obligation to open-source your code — see [`COMMERCIAL-LICENSE.md`](./COMMERCIAL-LICENSE.md). Contact: <hgutieco@gmail.com>.

© 2026 Harrinson Gutierrez Coronado.

---

Repo: https://github.com/harrinson-gutierrez/acm-tracker · License: AGPL-3.0 / Commercial.
