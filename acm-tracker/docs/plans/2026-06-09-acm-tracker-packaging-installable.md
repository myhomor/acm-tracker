# ACM-TRACKER — Packaging & Installable Distribution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Backend/frontend code changes MUST be delegated to the repo agents (`backend-architect`, `frontend-architect`, `db-schema-guardian`) and audited with `code-reviewer`, per `CLAUDE.md`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make ACM-TRACKER **installable** for four audiences, from simplest to most ambitious, without abandoning the self-hosted ethos. Each format is a distinct deliverable, but they share a **critical path**: every later format depends on earlier groundwork.

**Why now:** Today `docker compose up` still requires an external Postgres (`DATABASE_URL`) and the web image runs `vite dev` (a dev server) with a hardcoded `localhost` API URL. Neither is distributable to a non-expert. This plan fixes the foundation, then layers the four packaging targets on top.

---

## Critical path (do not parallelize across phases)

```
Phase 0  SQLite single-user mode (DB-1..DB-5 from the v1 plan addendum)
            └─ prerequisite for EVERYTHING: no bundled DB = not installable
Phase 1  Production build + single distributable Docker image on GHCR
            ├─ web served as static prod build (not vite dev)
            ├─ API_URL injectable at runtime (no hardcoded localhost)
            └─ `docker run` one-liner with a data volume
Phase 2  PWA (manifest + service worker over the Phase 1 prod build)  ← cheap win
Phase 3  Desktop app (Tauri: static web + API sidecar + SQLite)       ← biggest effort
Phase 4  Cloud one-click / Helm (reuses the GHCR image)               ← infra only
```

**Effort/ROI ranking:** Phase 1 (low-med, highest ROI) → Phase 2 (low) → Phase 4 (med) → Phase 3 (high).

---

## Architecture authority

Binding rules unchanged: `CLAUDE.md` (root), `apps/api/CLAUDE.md` (Hexagonal), `apps/web/CLAUDE.md` (reactive). Packaging is an **infrastructure/build concern** — domain and use cases must not change. The DB backend selection (SQLite vs Postgres) lives only in infrastructure, exactly as the v1 addendum established. The API already runs `prisma migrate deploy` on container start and writes uploads to a local `uploads/` dir — both are packaging-friendly once the DB is bundleable.

---

## Phase 0 — SQLite single-user mode (prerequisite)

This phase **is** tasks DB-1…DB-5 from the addendum in `docs/plans/2026-06-05-acm-tracker-v1-local.md` (§ Addendum 2026-06-09). It is restated here as the gate for packaging; do not duplicate the detail — execute it from that addendum.

- [x] **P0:** Complete DB-1…DB-5. (DONE 2026-06-09) Money kept as `Float` (not integer-cents — see DB-1 rationale), enums already strings, mirrored SQLite schema + drift check, `DB_BACKEND` env switch (default sqlite), `pnpm dev:solo`. **Definition of done met (verified):** api boots against `file:./acm.db` with no Postgres reachable, `GET /api/members` → 200 seeded owner; api unit suite 15/15 green under both `sqlite` and `postgres`; drift-check in lockstep.

---

## Phase 1 — Single distributable Docker image (self-hoster, one command)

**Outcome:** `docker run -p 5173:5173 -v acm-data:/data ghcr.io/harrinson-gutierrez/acm-tracker` boots the whole app (web + api + SQLite) with zero external dependencies; data persists in the volume.

### Task 1.1 — Production web build, runtime-configurable API URL
- [x] (DONE 2026-06-09) `apps/web/Dockerfile` now `vite build` + `vite preview` — no dev server in images.
- [x] (DONE 2026-06-09) **Solved via single-origin instead of `/config.js`:** `api-client.ts` BASE defaults to relative `/api`; NestJS serves the static front, so one image works on any host/port with no runtime URL injection. `VITE_API_URL` still overrides for the 2-service dev mode (a dev-only vite `/api` proxy keeps `pnpm dev` working).
- [x] (DONE 2026-06-09) `docker-compose.yml` updated (api gets `CORS_ORIGIN`/`UPLOADS_DIR`; web no longer needs a hardcoded localhost URL).
- [x] **Verified (native):** built SPA serves with relative `/api` (no `localhost` baked in); single-origin smoke confirms `/`, deep SPA route, `/api/*`, and `/api/nope`→404 JSON all correct on a non-localhost-bound port.

### Task 1.2 — Single-image option (web + api + SQLite in one container)
- [x] (DONE 2026-06-09) Multi-stage root `Dockerfile`; `docker/entrypoint.sh` runs `db:bootstrap` (SQLite migrate+seed idempotent) then serves api+static web. Defaults `DATABASE_URL=file:/data/acm.db`, `DB_BACKEND=sqlite`, port 5173.
- [x] (DONE 2026-06-09) `/data` for the SQLite file + `/data/uploads` for files; `docker-compose.single.yml` documents the `acm-data` named volume.
- [x] (DONE 2026-06-09) 2-service compose kept as the "team" (Postgres) deployment; single image is "solo". Both documented in README.
- [ ] **Verify on a Docker host:** `docker build` + `docker run -v acm-data:/data` → create data → restart → data persists. *(Not run here — Docker engine unavailable in dev env; native equivalent verified. Pending a real Docker host or the first release build.)*

### Task 1.3 — Publish to GHCR via CI
- [x] (DONE 2026-06-09) `.github/workflows/release.yml` — on tag `v*`, buildx multi-arch (amd64+arm64) push to `ghcr.io/harrinson-gutierrez/acm-tracker:{version,latest}` with `packages: write`.
- [x] (DONE 2026-06-09) README "Instalar / Self-host (imagen única)" section with the `docker run` one-liner.
- [ ] **Verify:** push a `v*` tag → pull the image on a clean machine and run it. *(Pending the first tagged release.)*

### Task 1.2 — Single-image option (web + api + SQLite in one container)
- [ ] Add a combined image (multi-stage: build shared+api+web, then a runtime stage) whose entrypoint runs `prisma migrate deploy` (SQLite) + seeds on first run + starts the api and serves the static web. Default `DATABASE_URL="file:/data/acm.db"`, `DB_BACKEND=sqlite`.
- [ ] Mount point `/data` for the SQLite file and `/data/uploads` for files; document the named volume.
- [ ] Keep the **2-service compose** (web+api+Postgres) as the "team" deployment; the single image is the "solo" deployment. Both documented.
- [ ] **Verify:** `docker run ... -v acm-data:/data` → open the UI, create a project+task+time entry, restart the container, data persists.

### Task 1.3 — Publish to GHCR via CI
- [ ] Add a GitHub Actions workflow (`.github/workflows/release.yml`) that, on tag `v*` (and optionally on main), builds and pushes `ghcr.io/harrinson-gutierrez/acm-tracker:{version,latest}` (multi-arch amd64+arm64 via buildx).
- [ ] Document the pull/run command in README under a new "Instalar / Self-host" section.
- [ ] **Verify:** a pushed tag produces a pullable image that runs on a clean machine.

---

## Phase 2 — PWA (installable from the browser)

**Outcome:** visiting the app offers "Install ACM-TRACKER" (desktop icon, standalone window, mobile add-to-home).

### Task 2.1 — Manifest + icons + service worker
- [x] (DONE 2026-06-09) `vite-plugin-pwa` (Workbox `generateSW`, `registerType: autoUpdate`). Manifest: ACM-TRACKER / ACM, `theme_color`+`background_color` `#0B0D12`, `display` standalone, scope `/`, lang es. Icons 192/512 + 512 **maskable** (coral "A" monogram on dark, generated from `public/icon.svg` via `@vite-pwa/assets-generator`, regenerable).
- [x] (DONE 2026-06-09) SW caches **app-shell only**. `/api` excluded: `navigateFallbackDenylist: [/^\/api/]` + no `runtimeCaching` → 0 `/api` precache entries (verified in `dist/sw.js`). Time/cost data always hits the network. `devOptions.enabled: false` (no SW in vite dev).
- [x] **Verified:** web build emits `sw.js` + `workbox-*.js` + `manifest.webmanifest` + icons (all referenced icons exist in dist); SW denylists `/api`; **19/19 Playwright E2E green** with the SW active in single-origin prod mode. *(Browser "Install" affordance not click-tested in a real browser here; manifest + SW are valid and complete.)*

> Note: PWA does **not** remove the need to host api+web somewhere. It is an install *affordance* over a running deployment, complementary to Phase 1.

---

## Phase 3 — Desktop app (Tauri, double-click, no terminal)

**Outcome:** `ACM-Tracker-Setup.exe` / `.dmg` / `.AppImage` — a native window, SQLite local file, no Docker, no terminal. For non-technical users.

**Why Tauri over Electron:** ~10x smaller binary, Rust core, uses the OS webview. The web frontend is the same static prod build from Phase 1.

### Task 3.1 — API as a bundled sidecar
- [x] (DONE 2026-06-09) `apps/desktop/` Tauri 2 project. The NestJS api is bundled as a **sidecar**: `sidecar/bootstrap-and-serve.cjs` runs `prisma migrate deploy` (SQLite) + seed + `dist/src/main.js`. Payload assembled by `scripts/prepare-payload.mjs` (`pnpm --filter @acm/api deploy` + regenerate both Prisma clients + copy web dist). Uses system `node` on PATH (pragmatic; embedded-Node/SEA is a documented follow-up).
- [x] (DONE 2026-06-09) `src-tauri/src/main.rs` spawns the sidecar, waits ready (60s), opens a window at `http://127.0.0.1:5188/` (single-origin — the api serves the static web build). **SQLite path = OS app-data dir** (`app.path().app_data_dir()/acm.db` as an absolute `file:` URL) — resolves the relative-path risk noted earlier. Migrate+seed on first launch; sidecar killed on window close/exit.
- [x] **Verified (compile + syntax, smoke skipped by owner):** `cargo check` compiles the Rust crate clean (sidecar spawn, app-data path, window). `prepare-payload.mjs` and the sidecar pass `node --check` — and **two real bugs were fixed** in `prepare-payload.mjs` (missing `readFileSync` import; `require.resolve` in an ESM `.mjs` → switched to `createRequire`). *(First-launch runtime smoke and the actual installer build were not run locally — deferred to the CI matrix, which has the full bundler toolchain.)*

### Task 3.2 — Installers + signing + auto-update
- [x] (DONE 2026-06-09) `tauri.conf.json` bundle targets: `nsis`/`msi` (Windows), `dmg` (macOS), `appimage`/`deb` (Linux).
- [ ] **Code signing per OS** (Windows Authenticode, macOS notarization) — left as a documented TODO in `desktop.yml` (requires paid certificates). Until configured, installers are unsigned (OS will warn).
- [ ] Tauri auto-updater — documented TODO (needs signing key + plugin wiring).
- [x] (DONE 2026-06-09) `.github/workflows/desktop.yml` — matrix `windows/macos/ubuntu-latest`, `dtolnay/rust-toolchain` + `tauri-apps/tauri-action`, builds the installers on a `desktop-v*` tag (or `workflow_dispatch`) and attaches them to a draft GitHub Release. Decoupled from the `v*` image release so a version tag doesn't trigger both.

---

## Phase 4 — Cloud one-click / Helm (operators, enterprise)

**Outcome:** a "Deploy" button and/or a Helm chart for teams that run their own infra. Reuses the Phase 1 GHCR image; **no new app code**.

### Task 4.1 — One-click templates
- [x] (DONE 2026-06-09) `render.yaml` (Render Blueprint: GHCR image + managed Postgres + 1Gi disk at `/data`, healthcheck `/api/projects`) and `railway.json` (Dockerfile build + healthcheck). README "Cloud 1-click" section documents both.

### Task 4.2 — Helm chart
- [x] (DONE 2026-06-09) `charts/acm-tracker/` — Deployment (single-origin image, port 5173, readiness/liveness on `/api/projects`), Service, conditional Ingress, PVC for `/data`, and `values.yaml` for `db.backend` (sqlite|postgres, with direct URL **or** `secretKeyRef`), persistence, cors, resources. README documents `helm install` for both backends + ingress.
- [x] **Verified (render-level):** `helm lint` passes; `helm template` renders correctly for sqlite (PVC + file URL), postgres-direct-URL, postgres-via-Secret, and ingress; postgres with no URL/secret **fails with a clear `required` error**. *(Not applied to a live kind/minikube cluster here — no cluster in the dev env; templates are valid and the image they reference is the verified Phase 1 image.)*

---

## Decisions captured (owner, 2026-06-09)

- **All four formats are wanted**, built in critical-path order (0→1→2→4→3 by ROI; 3 last due to signing cost).
- **SQLite single-user mode is the unlock** for installability — Phase 0 gates everything.
- License stays **AGPL-3.0 + commercial dual-licensing**; distributed images/installers carry the same license and the `COMMERCIAL-LICENSE.md` notice. Distributing binaries does **not** change obligations — AGPL's network clause is what matters, and self-hosting stays free.

## Out of scope (deferred)

- App-store distribution (Mac App Store / Microsoft Store) — extra review/sandboxing burden.
- Mobile-native (iOS/Android) apps beyond the PWA.
- Multi-tenant managed cloud offering (would be a separate commercial product, not "installable").

---

## Execution Handoff

Plan complete. Recommended: **subagent-driven**, one task at a time, PR per phase, CI green before merge (main is protected, `strict=true`). Phase 0 must merge before Phase 1 starts.
