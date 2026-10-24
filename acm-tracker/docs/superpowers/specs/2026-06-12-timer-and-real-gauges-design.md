# Timer real + datos reales en gauges — Design

**Fecha:** 2026-06-12
**Alcance:** dos items del roadmap (README → Next): "Real live timer" y "Margin and budget (real data in the gauges that currently show '—')".
**Modo de entrega:** 2 PRs independientes, cada uno con CI verde + squash merge.

## Contexto

- El `TimerDock` es puramente presentacional: `elapsed="00:00:00"`, `running=false` fijos, instanciado por separado en Cabina y Tracker, invisible en el resto de pantallas. No existe ningún flujo para arrancar un timer.
- Datos falsos/vacíos hoy: RingGauge de Cabina con `target={2400}` hardcodeado y `aiFraction={0}`; tile "Semana" = "—"; tile "Margen" = "—" con sub `"Helios"` fijo; panel MCP de Cabina con `rows={[]}`; tile "IA" del Tracker = `"$0"`.
- El margen POR PROYECTO ya es real (PR #20, `ProjectMarginPanel`). Falta el nivel global/Cabina.
- `WorkspaceSettings` existe en el schema Prisma pero ningún módulo de la API lo usa.
- Hallazgo UX de esta sesión: el usuario no encontraba la pantalla Tracker — sidebar solo-íconos con glifos crípticos y label únicamente en tooltip.

## Decisiones (validadas con el usuario)

1. **Estado del timer: backend (DB).** Entidad `TimerSession`; el front solo calcula `elapsed = now − startedAt`. Sobrevive a reiniciar app/navegador.
2. **Concurrencia: auto-stop y registra** (estilo Toggl). Máximo un timer activo por miembro; arrancar otro detiene y registra el anterior.
3. **Ubicación del timer: dock global fijo.** El `TimerDock` pasa al `Chrome` — barra fija al borde inferior de TODAS las pantallas (estilo Spotify/Toggl). Cabina y Tracker dejan de instanciar su propia copia.
4. **Objetivo del burn rate: setting editable.** `dailyCostTarget` en `WorkspaceSettings`, editable en Settings → Preferencias.
5. **Margen de Cabina: global agregado.** Σ(ingreso − costo humano) de todos los proyectos con tarifa de venta; sub del tile = "N proyectos".
6. **Sidebar con labels visibles** bajo los íconos (fix de descubribilidad), dentro del PR-1.

---

## PR-1 · Timer real

### Modelo de datos

Postgres + espejo SQLite en lockstep (migración en ambos schemas, drift-check verde):

```prisma
model TimerSession {
  id        String   @id @default(cuid())
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId  String   @unique   // máx. 1 timer activo por miembro
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskId    String
  startedAt DateTime @default(now())
}
```

- Timer corriendo = la fila existe. El elapsed nunca se persiste.
- `onDelete: Cascade` en `task`: borrar la tarea elimina la sesión (sin timers huérfanos).

### Backend — módulo hexagonal `timer`

Mismo layout que los demás módulos (`domain/ports → application/use-cases → infrastructure/persistence → interfaces/http`).

- **Puerto** `TimerSessionPort`: `findActiveByMember`, `create`, `delete` (+ datos de tarea/proyecto para display). Adaptador Prisma.
- **Use cases:**
  - `StartTimerUseCase(memberId, taskId)`: si hay sesión activa → ejecuta el stop (registra) primero; crea la sesión nueva. Valida que la tarea exista (404 claro).
  - `StopTimerUseCase(memberId)`: `minutes = max(1, round((now − startedAt) / 60000))`; crea el `TimeEntry` con `origin: "timer"`, `ratePerHourSnapshot` = tarifa actual del miembro, `billable: true`; borra la sesión. Reusa el use case de creación del módulo `time-entries` (composición entre módulos Nest — la lógica de costo/snapshot no se duplica). Sin timer activo → 404.
  - `GetActiveTimerUseCase(memberId)`: sesión + `taskCode`, `taskTitle`, `projectName`, `startedAt`, o `null`.
- **REST:** `POST /timer/start {taskId}`, `POST /timer/stop`, `GET /timer/active`. Miembro = owner (NoAuth, como el resto de la API).
- `origin: "timer"` es un valor nuevo del campo String existente (cero migración extra). En la timeline del Tracker sale con Tag propio, distinguible de `manual` y `mcp`.

### Frontend

- `features/timer/api`: `useActiveTimer()` (GET, `refetchInterval` 30s como red de seguridad multi-ventana), `useStartTimer()`, `useStopTimer()`. El stop invalida: active-timer, today-summary, team-today, today-entries, project-cost, weekly.
- Hook `useElapsed(startedAt)`: tick de 1s en cliente, formato `HH:MM:SS`.
- **TimerDock global:** se renderiza desde `Chrome` (fijo al borde inferior, full-width, sobre el contenido con padding-bottom para no tapar). Estados:
  - **Reposo:** `○ SIN TIMER` + botón coral primario `▶ Iniciar timer` (abre picker proyecto→tarea: los mismos selects del `TimeEntryModal` pero sin campo minutos) + secundario `+ registrar tiempo` (modal manual existente).
  - **Corriendo:** `● EN CURSO`, cronómetro vivo, `T-xxx · título · proyecto · $rate/h`, botón `◼ STOP`.
- **Atajo contextual:** botón `▶` en cada fila de tarea del Project detail (`TaskRow`) — arranca directo sin picker.
- Cabina y Tracker eliminan sus instancias propias del dock (queda solo el global).
- **Sidebar:** labels mono uppercase ~8-9px bajo cada ícono (TRACKER, COSTOS…), ancho del rail 64→~76px. Solo `Chrome.tsx`.

### Flujo

```
   ▶ (fila de tarea o dock)        ◼ STOP / ▶ otra tarea
SIN TIMER ──────────► ● EN CURSO ──────────► TimeEntry (origin: timer)
                      HH:MM:SS cuenta
```

### Edge cases

- Stop sin timer → 404 con mensaje claro; la UI nunca lo ofrece (el dock muestra STOP solo si hay activo).
- Stop inmediato tras start → mínimo 1 minuto (no se crean entradas de 0).
- Tarea borrada con timer corriendo → cascade elimina la sesión; el dock vuelve a reposo en el próximo refetch.
- Multi-ventana: la otra ventana converge por el `refetchInterval` de 30s.

### Tests

- Unit: 3 use cases (incluye auto-stop-y-registra, mínimo 1 min, 404s).
- E2E Playwright: `▶` en tarea → dock `EN CURSO` → STOP → entrada `timer` en la timeline del Tracker con costo correcto; iniciar desde el dock con picker; auto-stop al cambiar de tarea; dock visible en una pantalla que antes no lo tenía (ej. Costos).

---

## PR-2 · Datos reales en gauges

### 1. Objetivo diario editable

- Columna `dailyCostTarget Float @default(2400)` en `WorkspaceSettings` (Postgres + espejo SQLite, lockstep).
- Módulo hexagonal nuevo `workspace-settings`: `GET /workspace-settings`, `PATCH /workspace-settings` (upsert de la fila id=1).
- UI: Settings → Preferencias, campo "Objetivo diario de costo" inline (reusa `EditableRate`, formato money).
- El RingGauge de Cabina lee `dailyCostTarget` real.

### 2. Burn rate honesto

- `GET /reports/today` se extiende con: `aiCost` (Σ `AiRun.costUsd` de entradas de hoy) y `weekMinutes` (minutos trackeados del workspace, lunes→hoy).
- RingGauge: `total = costo humano + aiCost`, `aiFraction = aiCost / total` (0 si total=0).
- Tile "Semana" = `weekMinutes` ("de 40h"). Tile "IA" del Tracker = `$aiCost`.

### 3. Margen global

- Use case `margin-summary` en el módulo `reporting` → `GET /reports/margin-summary`.
- Por cada proyecto con `ratePerHour` definido (fórmula del PR #20): `revenue = horasReales × ratePerHour proyecto`; `cost = Σ(minutes × ratePerHourSnapshot / 60)`. Agregado: `{ margin, revenue, cost, projectCount }`.
- Tile "Margen" de Cabina: margen total (verde si ≥0, coral si <0), sub = `"{projectCount} proyectos"`.

### 4. Panel MCP de Cabina vivo

- Cablear al `GET /mcp/reports` existente: hook compartido + mapeo a filas del `McpStream` (últimos ~6). Cero backend nuevo.

### Tests

- Unit: `margin-summary`, today extendido (aiCost/weekMinutes), workspace-settings.
- E2E: editar objetivo → gauge refleja el target nuevo; tile margen con datos del seed; reporte MCP visible en el stream de la Cabina; tile IA del Tracker.

---

## Fuera de alcance

- Pausar/reanudar el timer (solo start/stop).
- Timer por persona ≠ owner (llega con Cognito/multi-usuario).
- Targets por proyecto o por fechas de proyecto.
- Notificaciones del timer (idle detection, recordatorios).
- i18n: las cadenas nuevas entran en ambos catálogos (es/en) como siempre — no es alcance nuevo, es regla del repo.
