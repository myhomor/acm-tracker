# ACM-TRACKER — UI Figma Fidelity (Master Plan, 13 screens)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the entire ACM-TRACKER frontend so every screen is a faithful reproduction of its Flight Deck Figma frame — instrument topbar, ring gauges, technical grid, registration marks, dense panels, MCP stream, timer dock — wired to the existing reactive data layer.

**Architecture:** Frontend-only (the hexagonal backend already exposes every endpoint these screens need). Reactive: TanStack Query for server state, Zustand for UI state, decoupled reusable presentational components in `apps/web/src/components`. Each screen composes shared Flight Deck primitives. Where a screen needs data the backend doesn't yet aggregate (e.g. team-cost-today, today totals), this plan notes it and either reuses an existing endpoint or stubs presentationally with a clear marker — NO fabricated business data presented as real.

**Tech Stack:** React 18 + Vite, TanStack Query, Zustand, TypeScript, `@acm/shared`. Theme: Flight Deck tokens already in `apps/web/src/theme/tokens.ts`.

**Authority:** `CLAUDE.md` (root), `apps/web/CLAUDE.md` (reactive, decoupled reusable components). Delegate to **frontend-architect**; audit with **code-reviewer**. This plan is immutable once written — update only checkbox state during execution.

**Design source of truth:** the PNG frames in `docs/design/` (each task names its frame). The implementation must match the named PNG: layout, panels, labels, colors, typography (JetBrains Mono for data, Inter for labels), spacing. Example project everywhere is "Helios".

**Verification model (per screen):** because this is visual fidelity, each screen task ends with: build clean → run the stack → open the route in a browser (Playwright) → screenshot → compare against the named `docs/design/*.png` → fix discrepancies. A screen is "done" only when it visually matches its frame.

---

## The 13 designed screens (inventory + routes + frame)

| # | Screen | Route | Frame (docs/design) | Backend status |
|---|--------|-------|---------------------|----------------|
| 1 | Cabina (Hoy) | `/` | 01-cabina.png | reuse projects/members/reports; "today totals" + team-today need aggregation |
| 2 | Project detail | `/projects/:id` | 04-project-detail.png | reuse project, tasks, project-cost, by-person |
| 3 | Costos & IA | `/costs` | 02-costos-ia.png | reuse model-prices, reports; AI = $0 |
| 4 | Reportes · analytics | `/reports` | 07-reportes.png | reuse by-person, weekly |
| 5 | Servidor MCP | `/mcp` | 03-mcp.png | presentational (real MCP is a later phase) — show endpoint/contract/empty stream |
| 6 | Time tracker · daily | `/tracker` | 08-time-tracker.png | reuse time-entries; "today timeline" needs an endpoint |
| 7 | Settings · members & pricing | `/settings` | 05-settings-pricing.png | reuse members, model-prices |
| 8 | Notificaciones | `/notifications` | 09-notificaciones.png | presentational (channels/rules are config; backend later) |
| 9 | Auth · sign-in | `/auth` | 10-auth.png | presentational (NoAuth mode; real auth later) |
| 10 | Command palette | overlay (⌘K) | 11-command-palette.png | client-only (navigation + actions) |
| 11 | Documentos (global) | `/documents` | 12-documentos-global.png | presentational shell (documents backend is a later phase) |
| 12 | Documentos (proyecto) | `/projects/:id` tab | 13-documentos-proyecto.png | presentational shell |
| 13 | Mobile (PWA) | responsive of `/` | 06-mobile.png | same data as Cabina |

> Screens 5, 8, 9, 11, 12 are **presentational shells** in this plan — they reproduce the design faithfully but their dynamic data arrives in later backend phases (MCP server, notifications config, auth provider, documents base). They are clearly marked in-UI where data is not yet live (e.g. "vía MCP · próximamente", empty states), never faking business numbers.

---

## Shared Flight Deck component library (built/enriched first)

Reusable, presentational (props in, JSX out — never fetch). Under `apps/web/src/components/`.

```
components/
├── Chrome/            # EXISTS — enrich: instrument topbar (breadcrumb + status + clock + user)
├── Panel/             # EXISTS — keep
├── Gauge/             # EXISTS — enrich: optional inner ring (dual: human outer + AI inner)
├── Timer/             # EXISTS — keep (used by TimerDock)
├── StatTile/          # EXISTS — keep
├── DonutGauge/        # EXISTS — keep
├── StackedBars/       # EXISTS — keep
├── RingGauge/         # NEW — big burn-rate gauge w/ dual ring + center figure + legend
├── Avatar/            # NEW — colored initials chip (HE/MA/JO/VL)
├── TileRow/           # NEW — row of StatTiles (HOY/SEMANA/FACT/MARGEN)
├── PersonCostRow/     # NEW — avatar + name + tracked + cost (team panels)
├── McpStream/         # NEW — live-ingest log rows (time·who·task·hrs·$·model→$)
├── TimerDock/         # NEW — bottom running-timer bar (coral border)
├── DataTable/         # NEW — generic header+rows table (tasks, docs, reports)
├── Tag/               # NEW — small status/phase pill (colored)
├── SideNav/           # NEW — settings/docs left sidebar
└── CommandPalette/    # NEW — ⌘K overlay modal
```

All new components are presentational and reused across screens (e.g. `McpStream` appears in Cabina and MCP screen; `PersonCostRow` in Cabina and Project detail; `DataTable` in Project detail, Reports, Documents).

---

## Phase 1 — Shared Flight Deck components

> Build/enrich the reusable presentational primitives first; screens compose them. Each component: props in, JSX out, theme tokens only, no data fetching. Verify with a quick build after each cluster.

### Task 1: Enrich Chrome (instrument topbar)

**Files:**
- Modify: `apps/web/src/components/Chrome/Chrome.tsx`

Frame reference: the topbar in every `docs/design/*.png` — left `◆ ACM-TRACKER` + breadcrumb + optional middle status; right a status dot + label + user menu `HG ▾`.

- [x] **Step 1: Replace Chrome with the richer instrument topbar**

```tsx
import type { CSSProperties, ReactNode } from "react";
import { colors } from "../../theme/tokens";

interface ChromeProps {
  breadcrumb: string;
  status?: string;
  statusColor?: string;
  children: ReactNode;
}

function Mark({ pos }: { pos: CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 14, height: 14, ...pos }}>
      <div style={{ position: "absolute", width: 14, height: 1, background: colors.coral, opacity: 0.7 }} />
      <div style={{ position: "absolute", width: 1, height: 14, background: colors.coral, opacity: 0.7 }} />
    </div>
  );
}

export function Chrome({ breadcrumb, status = "LIVE", statusColor = colors.green, children }: ChromeProps) {
  return (
    <div className="grid-bg" style={{ minHeight: "100vh", position: "relative", padding: 28 }}>
      <Mark pos={{ top: 14, left: 14 }} />
      <Mark pos={{ top: 14, right: 14 }} />
      <Mark pos={{ bottom: 14, left: 14 }} />
      <Mark pos={{ bottom: 14, right: 14 }} />
      <header style={{ display: "flex", alignItems: "center", height: 52, padding: "0 20px", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 24 }}>
        <span className="mono" style={{ color: colors.coral, fontWeight: 700, letterSpacing: 1 }}>◆ ACM-TRACKER</span>
        <span className="mono" style={{ color: colors.muted, marginLeft: 24, fontSize: 13 }}>{breadcrumb}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: statusColor }} />
          <span className="mono" style={{ color: statusColor, fontSize: 12, letterSpacing: 1 }}>{status}</span>
          <span className="mono" style={{ color: colors.text, fontSize: 13, marginLeft: 16 }}>HG ▾</span>
        </span>
      </header>
      {children}
    </div>
  );
}
```

- [x] **Step 2: Build**

Run: `pnpm --filter @acm/web build`
Expected: clean (existing screens still pass `breadcrumb`; new props are optional).

- [x] **Step 3: Commit**

```bash
git add apps/web/src/components/Chrome
git commit -m "feat(web): enrich Chrome instrument topbar (status + user)"
```

---

### Task 2: RingGauge (dual-ring burn rate)

**Files:**
- Create: `apps/web/src/components/RingGauge/RingGauge.tsx` + `index.ts`

Frame reference: `docs/design/01-cabina.png` — big gauge, coral outer ring (cost vs target) + blue inner arc (AI share), center figure `$1,840`, `77% del objetivo`, legend rows below.

- [x] **Step 1: Create `RingGauge.tsx`**

```tsx
import { colors } from "../../theme/tokens";

interface RingGaugeProps {
  total: number;        // center figure (e.g. 1840)
  target: number;       // for the outer ring fraction
  aiFraction: number;   // 0..1 inner arc
  caption: string;      // e.g. "del objetivo"
}

export function RingGauge({ total, target, aiFraction, caption }: RingGaugeProps) {
  const pct = target > 0 ? Math.min(total / target, 1) : 0;
  const rOuter = 86, rInner = 64;
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;
  return (
    <svg width={260} height={260} viewBox="0 0 260 260" role="img" aria-label={`${caption}: ${total} of ${target}`}>
      <circle cx={130} cy={130} r={rOuter} fill="none" stroke={colors.surface2} strokeWidth={16} />
      <circle cx={130} cy={130} r={rOuter} fill="none" stroke={colors.coral} strokeWidth={16}
        strokeDasharray={cOuter} strokeDashoffset={cOuter * (1 - pct)} strokeLinecap="round" transform="rotate(-90 130 130)" />
      <circle cx={130} cy={130} r={rInner} fill="none" stroke={colors.surface2} strokeWidth={8} />
      <circle cx={130} cy={130} r={rInner} fill="none" stroke={colors.blue} strokeWidth={8}
        strokeDasharray={cInner} strokeDashoffset={cInner * (1 - Math.min(aiFraction, 1))} strokeLinecap="round" transform="rotate(-90 130 130)" />
      <text x={130} y={126} textAnchor="middle" className="mono" fill={colors.text} fontSize={44} fontWeight={700}>
        {`$${total.toLocaleString()}`}
      </text>
      <text x={130} y={152} textAnchor="middle" className="mono" fill={colors.coral} fontSize={14}>
        {`${Math.round(pct * 100)}%`}
      </text>
      <text x={130} y={172} textAnchor="middle" fill={colors.dim} fontSize={11}>{caption}</text>
    </svg>
  );
}
```

- [x] **Step 2: Create `index.ts`**: `export { RingGauge } from "./RingGauge";`

- [x] **Step 3: Build + commit**

Run: `pnpm --filter @acm/web build` (expect clean)
```bash
git add apps/web/src/components/RingGauge
git commit -m "feat(web): RingGauge dual-ring burn-rate component"
```

---

### Task 3: Avatar, Tag, TileRow, PersonCostRow

**Files:**
- Create: `apps/web/src/components/Avatar/Avatar.tsx` + `index.ts`
- Create: `apps/web/src/components/Tag/Tag.tsx` + `index.ts`
- Create: `apps/web/src/components/TileRow/TileRow.tsx` + `index.ts`
- Create: `apps/web/src/components/PersonCostRow/PersonCostRow.tsx` + `index.ts`

Frame reference: `01-cabina.png` (avatars HE/MA/JO/VL, tiles HOY/SEMANA/FACT/MARGEN, person rows), `04-project-detail.png`.

- [x] **Step 1: Create `Avatar.tsx`** (colored initials chip)

```tsx
import { colors } from "../../theme/tokens";

const PALETTE = [colors.coral, colors.blue, colors.green, colors.amber];

export function Avatar({ initials, index = 0, size = 34 }: { initials: string; index?: number; size?: number }) {
  const bg = PALETTE[index % PALETTE.length];
  return (
    <span
      className="mono"
      style={{ width: size, height: size, borderRadius: 8, background: bg, color: colors.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700 }}
    >
      {initials}
    </span>
  );
}
```

- [x] **Step 2: Create `Tag.tsx`** (status/phase pill)

```tsx
import { colors } from "../../theme/tokens";

export function Tag({ label, color = colors.muted }: { label: string; color?: string }) {
  return (
    <span className="mono" style={{ fontSize: 10, letterSpacing: 0.5, color, border: `1px solid ${color}`, borderRadius: 6, padding: "2px 8px", textTransform: "none" }}>
      {label}
    </span>
  );
}
```

- [x] **Step 3: Create `TileRow.tsx`** (row of StatTiles)

```tsx
import { StatTile } from "../StatTile";

export interface Tile {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function TileRow({ tiles, columns = 4 }: { tiles: Tile[]; columns?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}>
      {tiles.map((t) => (
        <StatTile key={t.label} label={t.label} value={t.value} sub={t.sub} accent={t.accent} />
      ))}
    </div>
  );
}
```

- [x] **Step 4: Create `PersonCostRow.tsx`**

```tsx
import { Avatar } from "../Avatar";
import { colors } from "../../theme/tokens";

interface PersonCostRowProps {
  initials: string;
  index: number;
  name: string;
  meta: string;   // e.g. "2h 40m · trackeado"
  cost: string;   // e.g. "$132"
}

export function PersonCostRow({ initials, index, name, meta, cost }: PersonCostRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${colors.border}` }}>
      <Avatar initials={initials} index={index} />
      <div style={{ marginLeft: 12, flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{name}</div>
        <div className="mono" style={{ fontSize: 11, color: colors.muted }}>{meta}</div>
      </div>
      <span className="mono" style={{ fontWeight: 700 }}>{cost}</span>
    </div>
  );
}
```

- [x] **Step 5: Create the four `index.ts` barrels**

`Avatar/index.ts`: `export { Avatar } from "./Avatar";`
`Tag/index.ts`: `export { Tag } from "./Tag";`
`TileRow/index.ts`: `export { TileRow } from "./TileRow"; export type { Tile } from "./TileRow";`
`PersonCostRow/index.ts`: `export { PersonCostRow } from "./PersonCostRow";`

- [x] **Step 6: Build + commit**

Run: `pnpm --filter @acm/web build` (expect clean)
```bash
git add apps/web/src/components/Avatar apps/web/src/components/Tag apps/web/src/components/TileRow apps/web/src/components/PersonCostRow
git commit -m "feat(web): Avatar, Tag, TileRow, PersonCostRow components"
```

---

### Task 4: McpStream, TimerDock, DataTable

**Files:**
- Create: `apps/web/src/components/McpStream/McpStream.tsx` + `index.ts`
- Create: `apps/web/src/components/TimerDock/TimerDock.tsx` + `index.ts`
- Create: `apps/web/src/components/DataTable/DataTable.tsx` + `index.ts`

Frame reference: `01-cabina.png` (MCP stream + timer dock), `03-mcp.png` (stream rows), `04-project-detail.png` / `07-reportes.png` (tables).

- [x] **Step 1: Create `McpStream.tsx`**

```tsx
import { colors } from "../../theme/tokens";

export interface McpStreamRow {
  time: string;
  who: string;
  task: string;
  hours: string;
  cost: string;
  ai: string;        // "+1.2k tok · opus → $0.34" or "manual · sin IA"
  aiColor?: string;
}

export function McpStream({ rows, emptyLabel = "Sin reportes aún" }: { rows: McpStreamRow[]; emptyLabel?: string }) {
  if (rows.length === 0) {
    return <div style={{ color: colors.muted, fontSize: 13, padding: "12px 0" }}>{emptyLabel}</div>;
  }
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
          <span className="mono" style={{ fontSize: 12, color: colors.dim, width: 52 }}>{r.time}</span>
          <span className="mono" style={{ fontSize: 12, color: colors.coral, fontWeight: 700, width: 30 }}>{r.who}</span>
          <span style={{ flex: 1, fontWeight: 500 }}>{r.task}</span>
          <span className="mono" style={{ fontSize: 12, color: colors.muted, width: 60 }}>{r.hours}</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, width: 56 }}>{r.cost}</span>
          <span className="mono" style={{ fontSize: 11, color: r.aiColor ?? colors.dim, width: 190 }}>{r.ai}</span>
        </div>
      ))}
    </div>
  );
}
```

- [x] **Step 2: Create `TimerDock.tsx`**

```tsx
import { colors } from "../../theme/tokens";

interface TimerDockProps {
  elapsed: string;     // "02:47:13"
  taskTitle: string;
  meta: string;        // "Helios · facturable · $48.50/h"
  onStop: () => void;
  onManual: () => void;
}

export function TimerDock({ elapsed, taskTitle, meta, onStop, onManual }: TimerDockProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, background: colors.surface2, border: `1.5px solid ${colors.coral}`, borderRadius: 12, padding: "16px 24px", marginTop: 16 }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: colors.coral, letterSpacing: 1.5 }}>● EN CURSO</div>
        <div className="mono" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>{elapsed}</div>
      </div>
      <div style={{ marginLeft: 12 }}>
        <div style={{ fontWeight: 600 }}>{taskTitle}</div>
        <div className="mono" style={{ fontSize: 12, color: colors.muted }}>{meta}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
        <button onClick={onStop} style={{ background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700 }}>◼ STOP</button>
        <button onClick={onManual} style={{ background: "transparent", color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 20px" }}>+ entrada manual</button>
      </div>
    </div>
  );
}
```

- [x] **Step 3: Create `DataTable.tsx`** (generic header + rows)

```tsx
import type { ReactNode } from "react";
import { colors } from "../../theme/tokens";

export interface Column {
  key: string;
  label: string;
  width?: number | string;
  align?: "left" | "right";
}

export interface Row {
  id: string;
  cells: Record<string, ReactNode>;
}

export function DataTable({ columns, rows, emptyLabel = "Sin datos" }: { columns: Column[]; rows: Row[]; emptyLabel?: string }) {
  return (
    <div>
      <div style={{ display: "flex", padding: "0 0 8px", borderBottom: `1px solid ${colors.border}` }}>
        {columns.map((c) => (
          <span key={c.key} className="mono" style={{ fontSize: 9, letterSpacing: 1, color: colors.dim, flex: c.width ? `0 0 ${typeof c.width === "number" ? `${c.width}px` : c.width}` : 1, textAlign: c.align ?? "left" }}>
            {c.label.toUpperCase()}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
          {columns.map((c) => (
            <span key={c.key} style={{ flex: c.width ? `0 0 ${typeof c.width === "number" ? `${c.width}px` : c.width}` : 1, textAlign: c.align ?? "left" }}>
              {r.cells[c.key]}
            </span>
          ))}
        </div>
      ))}
      {rows.length === 0 && <div style={{ color: colors.muted, fontSize: 13, padding: "12px 0" }}>{emptyLabel}</div>}
    </div>
  );
}
```

- [x] **Step 4: Create the three `index.ts` barrels**

`McpStream/index.ts`: `export { McpStream } from "./McpStream"; export type { McpStreamRow } from "./McpStream";`
`TimerDock/index.ts`: `export { TimerDock } from "./TimerDock";`
`DataTable/index.ts`: `export { DataTable } from "./DataTable"; export type { Column, Row } from "./DataTable";`

- [x] **Step 5: Build + commit**

Run: `pnpm --filter @acm/web build` (expect clean)
```bash
git add apps/web/src/components/McpStream apps/web/src/components/TimerDock apps/web/src/components/DataTable
git commit -m "feat(web): McpStream, TimerDock, DataTable components"
```

---

### Task 5: SideNav + CommandPalette

**Files:**
- Create: `apps/web/src/components/SideNav/SideNav.tsx` + `index.ts`
- Create: `apps/web/src/components/CommandPalette/CommandPalette.tsx` + `index.ts`

Frame reference: `05-settings-pricing.png` / `12-documentos-global.png` (left sidebar), `11-command-palette.png` (overlay).

- [x] **Step 1: Create `SideNav.tsx`**

```tsx
import { colors } from "../../theme/tokens";

export interface NavItem {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function SideNav({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <nav style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, minWidth: 220 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: colors.dim, marginBottom: 12 }}>{title.toUpperCase()}</div>
      {items.map((it) => (
        <button key={it.label} onClick={it.onClick}
          style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: it.active ? colors.text : colors.muted, fontWeight: it.active ? 600 : 400, padding: "8px 0", borderLeft: it.active ? `2px solid ${colors.coral}` : "2px solid transparent", paddingLeft: 10 }}>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
```

- [x] **Step 2: Create `CommandPalette.tsx`** (controlled overlay)

```tsx
import { colors } from "../../theme/tokens";

export interface Command {
  icon: string;
  label: string;
  hint?: string;
  onRun: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 160, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 600, background: colors.surface, border: `1px solid ${colors.borderStrong}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px", background: colors.surface2 }}>
          <span className="mono" style={{ color: colors.coral, fontSize: 18 }}>⌘</span>
          <span style={{ color: colors.dim }}>Buscar acción, proyecto, persona, tarea…</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: colors.dim }}>ESC</span>
        </div>
        <div style={{ padding: 12 }}>
          {commands.map((c, i) => (
            <button key={i} onClick={() => { c.onRun(); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "transparent", border: "none", color: colors.text, padding: "10px 12px", borderRadius: 8 }}>
              <span className="mono" style={{ color: colors.muted, width: 18 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>{c.label}</span>
              {c.hint && <span className="mono" style={{ fontSize: 11, color: colors.dim }}>{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 3: Create barrels + build + commit**

`SideNav/index.ts`: `export { SideNav } from "./SideNav"; export type { NavItem } from "./SideNav";`
`CommandPalette/index.ts`: `export { CommandPalette } from "./CommandPalette"; export type { Command } from "./CommandPalette";`

Run: `pnpm --filter @acm/web build` (expect clean)
```bash
git add apps/web/src/components/SideNav apps/web/src/components/CommandPalette
git commit -m "feat(web): SideNav + CommandPalette components"
```

---

## Phase 2 — Backend gaps for fidelity (minimal, additive)

Two Cabina/Tracker panels need data the backend doesn't aggregate yet. Add small read-only reporting use cases (hexagonal, reusing the existing `reporting` module + `CostAggregationPort`). Delegate to **backend-architect**.

### Task 6: "Today" aggregation endpoints

**Files:**
- Modify: `apps/api/src/modules/reporting/domain/ports/cost-aggregation.port.ts`
- Modify: `apps/api/src/modules/reporting/infrastructure/persistence/prisma-cost-aggregation.repository.ts`
- Create: `apps/api/src/modules/reporting/application/use-cases/today-summary.use-case.ts`
- Create: `apps/api/src/modules/reporting/application/use-cases/team-today.use-case.ts`
- Modify: `apps/api/src/modules/reporting/interfaces/http/reporting.controller.ts`
- Modify: `apps/api/src/modules/reporting/reporting.module.ts`
- Test: `apps/api/src/modules/reporting/application/use-cases/today-summary.use-case.spec.ts`

> "Today" is derived from `TimeEntry.startedAt` on the current date. Because the aggregation repository must not call `new Date()` at module scope (deterministic test concern), the use case receives the day boundaries; the controller computes them per request.

- [x] **Step 1: Extend the port**

Add to `CostAggregationPort`:
```typescript
import type { PersonCost, WeeklyCost } from "@acm/shared";

export interface TodaySummary {
  trackedMinutes: number;
  billableMinutes: number;
  cost: number;
}

export interface TeamTodayRow {
  memberId: string;
  name: string;
  initials: string;
  trackedMinutes: number;
  cost: number;
}

// add to interface CostAggregationPort:
//   todaySummary(from: Date, to: Date): Promise<TodaySummary>;
//   teamToday(from: Date, to: Date): Promise<TeamTodayRow[]>;
```

- [x] **Step 2: Implement in the Prisma adapter**

```typescript
// add these methods to PrismaCostAggregationRepository (reuse computeEntryCost + round2):
async todaySummary(from: Date, to: Date): Promise<TodaySummary> {
  const rows = await this.prisma.timeEntry.findMany({ where: { startedAt: { gte: from, lt: to } } });
  let cost = 0, tracked = 0, billable = 0;
  for (const r of rows) {
    cost += computeEntryCost(r as unknown as TimeEntry);
    tracked += r.minutes;
    if (r.billable) billable += r.minutes;
  }
  return { trackedMinutes: tracked, billableMinutes: billable, cost: round2(cost) };
}

async teamToday(from: Date, to: Date): Promise<TeamTodayRow[]> {
  const members = await this.prisma.member.findMany({ orderBy: { createdAt: "asc" } });
  const out: TeamTodayRow[] = [];
  for (const m of members) {
    const rows = await this.prisma.timeEntry.findMany({ where: { memberId: m.id, startedAt: { gte: from, lt: to } } });
    let cost = 0, tracked = 0;
    for (const r of rows) { cost += computeEntryCost(r as unknown as TimeEntry); tracked += r.minutes; }
    const initials = m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    out.push({ memberId: m.id, name: m.name, initials, trackedMinutes: tracked, cost: round2(cost) });
  }
  return out;
}
```
Import the two new types at the top of the adapter (`TodaySummary`, `TeamTodayRow` from the port file).

- [x] **Step 3: Write the failing test for the use case**

```typescript
import { TodaySummaryUseCase } from "./today-summary.use-case";
import type { PersonCost, WeeklyCost } from "@acm/shared";
import { CostAggregationPort, ProjectCostRow, TodaySummary, TeamTodayRow } from "../../domain/ports/cost-aggregation.port";

class FakeAgg implements CostAggregationPort {
  async projectHumanCost(): Promise<ProjectCostRow> { return { human: 0, minutes: 0 }; }
  async costByPerson(): Promise<PersonCost[]> { return []; }
  async weeklyHumanCost(): Promise<WeeklyCost[]> { return []; }
  async todaySummary(): Promise<TodaySummary> { return { trackedMinutes: 252, billableMinutes: 240, cost: 334 }; }
  async teamToday(): Promise<TeamTodayRow[]> { return []; }
}

describe("TodaySummaryUseCase", () => {
  it("returns the summary from the aggregation port", async () => {
    const useCase = new TodaySummaryUseCase(new FakeAgg());
    const r = await useCase.execute(new Date("2026-06-06T00:00:00Z"), new Date("2026-06-07T00:00:00Z"));
    expect(r).toEqual({ trackedMinutes: 252, billableMinutes: 240, cost: 334 });
  });
});
```

- [x] **Step 4: Run to verify it fails**

Run: `pnpm --filter @acm/api test today-summary`
Expected: FAIL — module not found.

- [x] **Step 5: Create the two use cases**

`today-summary.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import { COST_AGGREGATION, CostAggregationPort, TodaySummary } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class TodaySummaryUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}
  execute(from: Date, to: Date): Promise<TodaySummary> {
    return this.agg.todaySummary(from, to);
  }
}
```

`team-today.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import { COST_AGGREGATION, CostAggregationPort, TeamTodayRow } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class TeamTodayUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}
  execute(from: Date, to: Date): Promise<TeamTodayRow[]> {
    return this.agg.teamToday(from, to);
  }
}
```

- [x] **Step 6: Add controller routes + register in module**

In `reporting.controller.ts`, inject both use cases and add:
```typescript
@Get("reports/today") today() {
  const { from, to } = dayBounds();
  return this.todaySummary.execute(from, to);
}
@Get("reports/team-today") teamTodayRoute() {
  const { from, to } = dayBounds();
  return this.teamToday.execute(from, to);
}
```
Add this helper at the bottom of the controller file (outside the class):
```typescript
function dayBounds(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + 86_400_000);
  return { from, to };
}
```
Register `TodaySummaryUseCase` and `TeamTodayUseCase` in `reporting.module.ts` providers.

- [x] **Step 7: Run test (pass) + build**

Run: `pnpm --filter @acm/api test today-summary && pnpm --filter @acm/api build`
Expected: PASS + clean build.

- [x] **Step 8: Commit**

```bash
git add apps/api/src/modules/reporting
git commit -m "feat(api): today + team-today aggregation endpoints for Cabina"
```

---

## Phase 3 — Screens (faithful to Figma)

> Each screen task: build the screen composing shared components to match its frame, wire to existing/new hooks, then verify by screenshot-vs-frame. Add the route in `App.tsx`. Add a new data hook only when the endpoint exists. Where data is not yet live, render the designed empty state / "próximamente" marker (never fake numbers).

### Task 7: Hooks for today + team-today

**Files:**
- Create: `apps/web/src/features/reporting/api/use-today.ts`

- [x] **Step 1: Create the hooks**

```typescript
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

interface TodaySummary { trackedMinutes: number; billableMinutes: number; cost: number; }
interface TeamTodayRow { memberId: string; name: string; initials: string; trackedMinutes: number; cost: number; }

export function useTodaySummary() {
  return useQuery({ queryKey: ["today-summary"], queryFn: () => apiClient.get<TodaySummary>("/reports/today") });
}
export function useTeamToday() {
  return useQuery({ queryKey: ["team-today"], queryFn: () => apiClient.get<TeamTodayRow[]>("/reports/team-today") });
}
```

- [x] **Step 2: Commit**

```bash
git add apps/web/src/features/reporting/api/use-today.ts
git commit -m "feat(web): today + team-today data hooks"
```

---

### Task 8: Cabina (rebuild faithful to 01-cabina.png)

**Files:**
- Modify: `apps/web/src/screens/Cabina.tsx`

Frame: `docs/design/01-cabina.png`. Layout: left column = RingGauge panel "BURN RATE · HOY" (with legend Humano/IA) + TileRow (HOY/SEMANA/FACTURABLE/MARGEN); right column = Panel "EQUIPO · COSTO REAL HOY" (PersonCostRow list) + Panel "MCP · INGESTA EN VIVO" (McpStream). Bottom = TimerDock.

- [x] **Step 1: Rebuild `Cabina.tsx`**

```tsx
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { RingGauge } from "../components/RingGauge";
import { TileRow } from "../components/TileRow";
import { PersonCostRow } from "../components/PersonCostRow";
import { McpStream } from "../components/McpStream";
import { TimerDock } from "../components/TimerDock";
import { useTodaySummary, useTeamToday } from "../features/reporting/api/use-today";
import { colors } from "../theme/tokens";

function hm(min: number): string { return `${Math.floor(min / 60)}h ${min % 60}m`; }

export function Cabina() {
  const { data: today } = useTodaySummary();
  const { data: team = [] } = useTeamToday();
  const cost = today?.cost ?? 0;
  return (
    <Chrome breadcrumb="FLIGHT DECK · cabina" status="SYSTEMS NOMINAL">
      <div style={{ display: "grid", gridTemplateColumns: "560px 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="Burn rate · hoy">
            <div className="mono" style={{ fontSize: 11, color: colors.dim, marginTop: -6, marginBottom: 8 }}>vs objetivo diario $2,400</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <RingGauge total={cost} target={2400} aiFraction={0} caption="del objetivo" />
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, background: colors.coral, borderRadius: 2 }} /><span className="mono" style={{ fontSize: 12 }}>Humano ${cost}</span></span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, background: colors.blue, borderRadius: 2 }} /><span className="mono" style={{ fontSize: 12 }}>IA $0 · vía MCP</span></span>
            </div>
          </Panel>
          <TileRow tiles={[
            { label: "Hoy", value: today ? hm(today.trackedMinutes) : "—", sub: "trackeado" },
            { label: "Semana", value: "—", sub: "de 40h" },
            { label: "Facturable", value: today ? hm(today.billableMinutes) : "—", accent: colors.green },
            { label: "Margen", value: "—", sub: "Helios", accent: colors.amber },
          ]} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="Equipo · costo real hoy">
            {team.map((p, i) => (
              <PersonCostRow key={p.memberId} initials={p.initials} index={i} name={p.name} meta={`${hm(p.trackedMinutes)} · trackeado`} cost={`$${p.cost}`} />
            ))}
            {team.length === 0 && <div style={{ color: colors.muted, fontSize: 13 }}>Sin actividad hoy.</div>}
          </Panel>
          <Panel title="MCP · ingesta en vivo">
            <McpStream rows={[]} emptyLabel="Sin reportes — el servidor MCP llega en una fase próxima." />
          </Panel>
        </div>
      </div>
      <TimerDock elapsed="00:00:00" taskTitle="Sin tarea activa" meta="inicia el timer en un proyecto" onStop={() => {}} onManual={() => {}} />
    </Chrome>
  );
}
```

> Cabina shows REAL today cost + team from the new endpoints; MCP stream is the designed empty state (live data arrives with the MCP phase); Semana/Margen tiles show "—" until those aggregations exist (not faked).

- [x] **Step 2: Build, run stack, screenshot vs frame**

Run: `pnpm --filter @acm/web build`; ensure stack up; open `http://localhost:5173/` in Playwright; screenshot; compare to `docs/design/01-cabina.png`. Fix layout/spacing/labels until it matches (gauge centered, two-column grid, panels titled, timer dock coral).

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens/Cabina.tsx
git commit -m "feat(web): Cabina faithful to Flight Deck frame"
```

---

### Task 9: Project detail (faithful to 04-project-detail.png)

**Files:**
- Modify: `apps/web/src/screens/ProjectDetail.tsx`

Frame: `docs/design/04-project-detail.png`. Header: avatar + "Helios · Plataforma fintech" + meta + tabs (Resumen/Tareas/Tiempo/Costos/Equipo/Documentos). Body: left "COSTO REAL · ACUMULADO" panel (big figure + human/AI split + stat row + progress) ; right "EQUIPO · COSTO REAL POR PERSONA" (DataTable). Bottom: "TAREAS · TIEMPO + COSTO" (DataTable with code/title/est/real/cost) + a margin mini-gauge + riesgos panel.

- [x] **Step 1: Rebuild `ProjectDetail.tsx`** composing `Chrome`, `Panel`, `Avatar`, `Tag`, `DataTable`, `DonutGauge`, using `useProject`, `useTasks`, `useCreateTask`, `useProjectCost`, `useCostByPerson`, and `TaskRow`'s cost via `useTaskCost` (reuse existing hooks). Header tabs are links; "Documentos" tab routes to the documents view (Task 18). Render the cost panel from `useProjectCost(id)` (human/ai/total/minutes — ai is 0). Tasks table reuses the existing add-task input. Keep "+ tiempo" per row.

```tsx
// Full composition — uses existing hooks (useProject, useTasks, useCreateTask, useProjectCost)
// and components (Chrome, Panel, Avatar, Tag, DataTable, DonutGauge). Build the three regions
// (header+tabs, cost+team, tasks+margin+risks) to match 04-project-detail.png. Each task row's
// cost comes from useTaskCost(task.id) via a small TaskCostCell feature component that calls the
// hook and renders minutes + $ (reuse the v1 TaskRow logic, restyled into DataTable cells).
```

> This task carries real code in the repo; the engineer composes the documented components. The cost figures are REAL (from useProjectCost / useTaskCost). "Riesgos" panel is a static designed placeholder (no risks backend yet) — label it as sample.

- [x] **Step 2: Build + screenshot vs `04-project-detail.png` + fix**

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens/ProjectDetail.tsx apps/web/src/features/tasks
git commit -m "feat(web): Project detail faithful to Flight Deck frame"
```

---

### Task 10: Costos & IA (faithful to 02-costos-ia.png)

**Files:**
- Modify: `apps/web/src/screens/Costs.tsx`

Frame: `docs/design/02-costos-ia.png`. Title "Costos · <mes>" + 4 StatTiles (TOTAL MES/HUMANO/IA/INFRA) + DonutGauge composition panel + "IA · COSTO POR MODELO" DataTable (model/in/out/$/1M/costo, from model-prices, costs 0) + "POR PROYECTO" panel + infra strip (designed placeholder).

- [x] **Step 1: Rebuild `Costs.tsx`** composing TileRow, DonutGauge, DataTable, Panel; data from `useModelPrices` + `useProjects` + per-project `useProjectCost`. AI column shows $0. Infra strip is a labeled sample (no infra backend).

- [x] **Step 2: Build + screenshot vs `02-costos-ia.png` + fix**

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens/Costs.tsx
git commit -m "feat(web): Costos & IA faithful to Flight Deck frame"
```

---

### Task 11: Reportes (faithful to 07-reportes.png)

**Files:**
- Modify: `apps/web/src/screens/Reports.tsx`

Frame: `docs/design/07-reportes.png`. Title "Reportes · analítica" + 5 StatTiles (HORAS/COSTO TOTAL/COSTO IA/$/HORA PROM/UTILIZACIÓN) + "TIEMPO+COSTO · POR SEMANA" StackedBars panel (legend humano/ia) + "POR PERSONA · COSTO REAL" DataTable (persona/horas/ia/costo) + "EXPORTAR / FACTURAR" three cards. Real data from `useCostByPerson` + `useWeeklyCost`; IA = 0; KPIs derived from those (HORAS = Σ minutes, COSTO TOTAL = Σ human, etc.); UTILIZACIÓN/$ HORA computed; export cards are buttons (no backend export yet — disabled or "próximamente").

- [x] **Step 1: Rebuild `Reports.tsx`** with the 5 KPIs computed from the hooks, StackedBars, DataTable by-person, and 3 export cards. Mark export buttons "próximamente".

- [x] **Step 2: Build + screenshot vs `07-reportes.png` + fix**

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens/Reports.tsx
git commit -m "feat(web): Reportes faithful to Flight Deck frame"
```

---

### Task 12: Settings (faithful to 05-settings-pricing.png)

**Files:**
- Modify: `apps/web/src/screens/Settings.tsx`

Frame: `docs/design/05-settings-pricing.png`. Left `SideNav` (Workspace/Miembros & tarifas/Precios de modelos/MCP & tokens/Notificaciones/Facturación/Auditoría) + right: "MIEMBROS & TARIFAS" DataTable (avatar/name/role/rate input/estado Tag) and "PRECIOS DE MODELOS" DataTable with the add form (reuse existing create) + delete per row. Keep the auth-provider section ("Conectar Cognito · próximamente").

- [x] **Step 1: Rebuild `Settings.tsx`** with SideNav + the two tables (members, model-prices) faithful to the frame; reuse `useMembers`, `useModelPrices`, `useCreateModelPrice`.

- [x] **Step 2: Build + screenshot vs `05-settings-pricing.png` + fix**

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens/Settings.tsx
git commit -m "feat(web): Settings faithful to Flight Deck frame"
```

---

### Task 13: Time tracker (faithful to 08-time-tracker.png)

**Files:**
- Create: `apps/web/src/screens/Tracker.tsx`
- Create: `apps/web/src/features/time-entries/api/use-today-entries.ts` (only if a today-entries endpoint exists; otherwise reuse per-task entries and label the timeline accordingly)
- Modify: `apps/web/src/App.tsx` (route `/tracker`)

Frame: `docs/design/08-time-tracker.png`. Title "Tiempo · <fecha>" + day totals tiles + left "LÍNEA DE TIEMPO" DataTable (hora/origen Tag MCP|manual/tarea/duración/costo) + right "OBJETIVO DEL DÍA" progress + "POR TAREA" rollup + TimerDock.

> The backend has `/time-entries/task/:taskId` but no "all entries today" endpoint. For fidelity without faking: render the timeline from the entries of the active project's tasks the user has (reuse what exists), OR add a tiny `/time-entries/today` endpoint (additive; same pattern as today-summary). The plan chooses: ADD `/time-entries/today` (one more aggregation) — see Step 1.

- [x] **Step 1: Add `/time-entries/today`** (backend, additive): a use case + controller route in the time-entries module returning today's entries with task code/title joined. Follow the hexagonal pattern (port method `findToday(from,to)`, adapter query `timeEntry.findMany({ where:{ startedAt:{gte,lt} }, include:{ task:true } })`, mapper to a `{time, origin, taskCode, taskTitle, minutes, cost}` view). Delegate to backend-architect.

- [x] **Step 2: Create `use-today-entries.ts`** hook (`useQuery(["today-entries"], () => apiClient.get("/time-entries/today"))`).

- [x] **Step 3: Create `Tracker.tsx`** composing Chrome + TileRow + DataTable (timeline) + Panel (objetivo/por tarea) + TimerDock, faithful to the frame.

- [x] **Step 4: Build + screenshot vs `08-time-tracker.png` + fix**

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/time-entries apps/web/src/screens/Tracker.tsx apps/web/src/features/time-entries apps/web/src/App.tsx
git commit -m "feat: Time tracker screen + today-entries endpoint, faithful to frame"
```

---

### Task 14: Servidor MCP (faithful to 03-mcp.png — presentational shell)

**Files:**
- Create: `apps/web/src/screens/Mcp.tsx`
- Modify: `apps/web/src/App.tsx` (route `/mcp`)

Frame: `docs/design/03-mcp.png`. Title "Servidor MCP" + endpoint card (URL + COPIAR) + token card (PAT masked + ROTAR) + "CONTRATO DE REPORTE · report_work()" code panel + "REPORTES RECIBIDOS" DataTable (McpStream-style). All presentational — the real MCP server is a later phase. Endpoint/token show placeholder values with a clear "próximamente / no activo" status; the contract code is the designed snippet; the received-reports table is the empty state.

- [x] **Step 1: Create `Mcp.tsx`** composing Chrome + Panel + a code block + McpStream(empty). Status dot/label = "MCP OFFLINE · próximamente" (amber), not green. COPIAR/ROTAR are disabled.

- [x] **Step 2: Build + screenshot vs `03-mcp.png` + fix**

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens/Mcp.tsx apps/web/src/App.tsx
git commit -m "feat(web): MCP screen shell faithful to frame (server is a later phase)"
```

---

### Task 15: Notificaciones (faithful to 09-notificaciones.png — presentational shell)

**Files:**
- Create: `apps/web/src/screens/Notifications.tsx`
- Modify: `apps/web/src/App.tsx` (route `/notifications`)

Frame: `docs/design/09-notificaciones.png`. Banner "solo avisos salientes" + channel cards (Slack/Email/WhatsApp/Webhook) + "REGLAS DE AVISO" DataTable with toggles. Presentational (channels/rules config backend is later). Toggles are visual; cards show "Conectar" (disabled) where not configured. Make clear in-UI these are not yet wired.

- [x] **Step 1: Create `Notifications.tsx`** composing Chrome + a banner + channel cards + DataTable of rules with toggle visuals.

- [x] **Step 2: Build + screenshot vs `09-notificaciones.png` + fix**

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens/Notifications.tsx apps/web/src/App.tsx
git commit -m "feat(web): Notifications screen shell faithful to frame"
```

---

### Task 16: Auth · sign-in (faithful to 10-auth.png — presentational)

**Files:**
- Create: `apps/web/src/screens/Auth.tsx`
- Modify: `apps/web/src/App.tsx` (route `/auth`)

Frame: `docs/design/10-auth.png`. Split: left brand panel with the big gauge motif + "Tiempo + costo, en una sola cabina." + self-hosted copy; right sign-in form (email/password + "Entrar →" + "¿Nuevo? Crear workspace"). Presentational — v1 runs NoAuth, so this screen is shown for design completeness; the "Entrar" button navigates to `/` (no real auth yet). Add a small note "modo sin auth — owner local".

- [x] **Step 1: Create `Auth.tsx`** (two-column, left uses a faint big RingGauge motif, right a styled form). "Entrar →" calls `navigate("/")`.

- [x] **Step 2: Build + screenshot vs `10-auth.png` + fix**

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens/Auth.tsx apps/web/src/App.tsx
git commit -m "feat(web): Auth sign-in screen faithful to frame (NoAuth mode)"
```

---

### Task 17: Command palette (faithful to 11-command-palette.png)

**Files:**
- Create: `apps/web/src/features/command-palette/use-command-palette.ts` (Zustand slice: open/close)
- Modify: `apps/web/src/App.tsx` (mount `CommandPalette` globally + ⌘K key listener)

Frame: `docs/design/11-command-palette.png`. Overlay with search bar + ACCIONES (Iniciar timer, Nueva entrada, Ver costo de hoy, Reporte cliente) + IR A (Cabina, Proyecto, Costos, MCP). Client-only; actions navigate.

- [x] **Step 1: Create the Zustand slice** (`useCommandPalette` with `open`, `setOpen`).

```typescript
import { create } from "zustand";

interface CommandPaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
```

- [x] **Step 2: Mount in `App.tsx`** — a global `useEffect` listening for `(e.metaKey||e.ctrlKey) && e.key==="k"` to toggle, and render `<CommandPalette open={open} onClose={...} commands={...}>` with `useNavigate` actions.

- [x] **Step 3: Build + screenshot vs `11-command-palette.png` (open state) + fix**

- [x] **Step 4: Commit**

```bash
git add apps/web/src/features/command-palette apps/web/src/App.tsx
git commit -m "feat(web): ⌘K command palette faithful to frame"
```

---

### Task 18: Documentos (global + project tab) (faithful to 12 & 13)

**Files:**
- Create: `apps/web/src/screens/Documents.tsx`
- Modify: `apps/web/src/App.tsx` (route `/documents`)
- Modify: `apps/web/src/screens/ProjectDetail.tsx` (Documentos tab content)

Frames: `docs/design/12-documentos-global.png`, `docs/design/13-documentos-proyecto.png`. Global: SideNav (espacios + por fase) + toolbar (search + Tipo/Fase filters + Nuevo) + DataTable of docs (icon by type, project, phase Tag, updated, COSTO PROD.). Project tab: phase-grouped doc cards + right rail (almacenamiento + costo documental). Presentational shell — the documents backend is a later phase; show the designed empty state ("sin documentos — la base documental llega en una fase próxima") with the full chrome/filters visible.

- [x] **Step 1: Create `Documents.tsx`** (global) composing Chrome + SideNav + toolbar + DataTable(empty designed state).

- [x] **Step 2: Add the Documentos tab** to ProjectDetail showing phase-grouped empty cards + right rail, faithful to `13-documentos-proyecto.png`.

- [x] **Step 3: Build + screenshot vs both frames + fix**

- [x] **Step 4: Commit**

```bash
git add apps/web/src/screens/Documents.tsx apps/web/src/screens/ProjectDetail.tsx apps/web/src/App.tsx
git commit -m "feat(web): Documents global + project tab shells faithful to frames"
```

---

### Task 19: Mobile fidelity (06-mobile.png) + responsive Cabina

**Files:**
- Modify: `apps/web/src/screens/Cabina.tsx` (responsive) OR Create `apps/web/src/screens/CabinaMobile.tsx`

Frame: `docs/design/06-mobile.png`. The Cabina condensed for 390px: mini dual-ring gauge, stat tiles, MCP feed, timer dock, bottom nav. Add responsive breakpoints to Cabina (single column under 640px, smaller gauge) so the same route works on mobile, matching the frame.

- [x] **Step 1: Add responsive layout** to Cabina (media-query via a small `useIsMobile` hook or CSS) so it collapses to one column and a bottom nav appears, matching `06-mobile.png`.

- [x] **Step 2: Build + screenshot at 390px viewport vs `06-mobile.png` + fix**

- [x] **Step 3: Commit**

```bash
git add apps/web/src/screens
git commit -m "feat(web): responsive mobile Cabina faithful to frame"
```

---

### Task 20: Navigation wiring + final pass

**Files:**
- Modify: `apps/web/src/App.tsx`, `apps/web/src/screens/Cabina.tsx`

- [x] **Step 1: Ensure all routes exist** in `App.tsx`: `/`, `/projects`, `/projects/:id`, `/costs`, `/reports`, `/tracker`, `/mcp`, `/notifications`, `/documents`, `/settings`, `/auth`. Add a persistent way to reach them (the command palette + Cabina links, matching the design's navigation affordances).

- [x] **Step 2: Full visual pass** — open each route in Playwright, screenshot, compare to its frame, fix any remaining discrepancies (spacing, colors, labels, fonts).

- [x] **Step 3: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): wire all routes + final Flight Deck fidelity pass"
```

---

## Self-Review (completed by plan author)

- **Coverage:** all 13 designed frames have a task — Cabina (8/19), Project detail (9), Costos (10), Reportes (11), Settings (12), Time tracker (13), MCP (14), Notificaciones (15), Auth (16), Command palette (17), Documentos global+proyecto (18), Mobile (19), nav (20). Shared components (1-5) + backend gaps (6-7) precede them.
- **Honesty:** screens with no backend yet (MCP, Notificaciones, Auth, Documentos) are presentational shells with designed empty states / "próximamente" markers — never fake business data. Real data screens (Cabina, Project, Costos, Reportes, Settings, Tracker) use real endpoints; AI cost = $0 until MCP.
- **Reuse:** every screen composes the shared component library; components are presentational (no fetch) per `apps/web/CLAUDE.md`. New backend is additive, hexagonal (today/team-today/today-entries aggregations reuse CostAggregationPort pattern).
- **Verification:** each screen task ends with screenshot-vs-frame comparison — the fidelity gate.
- **Placeholders:** component tasks carry full code; screen tasks 9-19 describe composition precisely and name the exact frame + components + hooks (the engineer composes documented parts). Tasks 1-8 and 17 carry complete code.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — frontend-architect per screen task, review (screenshot-vs-frame) between tasks.
2. **Inline Execution** — execute in this session, screenshot-vs-frame checkpoint per screen.
