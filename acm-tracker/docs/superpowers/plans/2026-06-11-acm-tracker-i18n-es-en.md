# ACM-TRACKER i18n (es/en) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Spanish/English internationalization to the `apps/web` front end with a language toggle in Settings, defaulting to Spanish, covering every screen and component with visible text.

**Architecture:** A single `react-i18next` instance initialized in `i18n/index.ts` and imported once in `main.tsx`. Two static JSON catalogs (`es.json` source of truth, `en.json` translation). Components consume strings via `useTranslation()`/`t('namespace.key')`. Language persists in `localStorage['acm.lang']` with browser detection only on first run. 100% frontend — no backend, DB, or hexagonal seam touched.

**Tech Stack:** React 18, Vite 5, TypeScript, `i18next`, `react-i18next`, `i18next-browser-languagedetector`, Vitest, Playwright.

**Project rule:** Edits to `apps/web` are delegated to the `frontend-architect` agent and audited by `code-reviewer`. `main` is protected — work on branch `feat/i18n-es-en`, finish via PR + squash. The required CI check is `build-test-e2e`.

---

### Task 0: Branch + dependencies + commit the design spec

**Files:**
- Modify: `apps/web/package.json` (add deps)
- Already created: `docs/superpowers/specs/2026-06-11-acm-tracker-i18n-and-claude-plugin-design.md`

- [ ] **Step 1: Create the feature branch**

Run (PowerShell):
```
git checkout -b feat/i18n-es-en
```

- [ ] **Step 2: Add i18n dependencies**

Run:
```
pnpm --filter @acm/web add i18next@^23 react-i18next@^14 i18next-browser-languagedetector@^8
```
Expected: `apps/web/package.json` gains the three deps under `dependencies`; lockfile updates.

- [ ] **Step 3: Verify install + build still green**

Run:
```
pnpm --filter @acm/web build
```
Expected: `tsc && vite build` completes with no errors.

- [ ] **Step 4: Commit (spec + deps)**

```
git add docs/superpowers/specs/2026-06-11-acm-tracker-i18n-and-claude-plugin-design.md apps/web/package.json pnpm-lock.yaml
git commit -m "chore(i18n): add design spec and i18next dependencies"
```

---

### Task 1: i18n core (init + catalogs + hook)

**Files:**
- Create: `apps/web/src/i18n/index.ts`
- Create: `apps/web/src/i18n/locales/es.json`
- Create: `apps/web/src/i18n/locales/en.json`
- Create: `apps/web/src/i18n/use-lang.ts`
- Test: `apps/web/src/i18n/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/i18n/i18n.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import i18n from "./index";

describe("i18n core", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to Spanish", () => {
    expect(i18n.language).toMatch(/^es/);
  });

  it("translates a known key in both languages", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.t("common.save")).toBe("Guardar");
    await i18n.changeLanguage("en");
    expect(i18n.t("common.save")).toBe("Save");
  });

  it("falls back to es for unsupported language", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("common.save")).toBe("Guardar");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
pnpm --filter @acm/web exec vitest run src/i18n/i18n.test.ts
```
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Create the catalogs**

`apps/web/src/i18n/locales/es.json`:
```json
{
  "common": {
    "save": "Guardar",
    "delete": "Borrar",
    "cancel": "Cancelar",
    "edit": "Editar",
    "add": "Agregar",
    "empty": "Sin datos"
  }
}
```

`apps/web/src/i18n/locales/en.json`:
```json
{
  "common": {
    "save": "Save",
    "delete": "Delete",
    "cancel": "Cancel",
    "edit": "Edit",
    "add": "Add",
    "empty": "No data"
  }
}
```

- [ ] **Step 4: Create the init module**

`apps/web/src/i18n/index.ts`:
```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import es from "./locales/es.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGS = ["es", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    fallbackLng: "es",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "acm.lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
```

- [ ] **Step 5: Create the language hook**

`apps/web/src/i18n/use-lang.ts`:
```ts
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS, type Lang } from "./index";

export function useLang() {
  const { i18n } = useTranslation();
  const lang = (SUPPORTED_LANGS.find((l) => i18n.language?.startsWith(l)) ?? "es") as Lang;
  const setLang = (next: Lang) => {
    i18n.changeLanguage(next);
  };
  return { lang, setLang, langs: SUPPORTED_LANGS };
}
```

- [ ] **Step 6: Enable JSON resolution in tsconfig (if not already)**

Check `apps/web/tsconfig.json` has `"resolveJsonModule": true`. If missing, add it under `compilerOptions`. If present, no change.

- [ ] **Step 7: Run test to verify it passes**

Run:
```
pnpm --filter @acm/web exec vitest run src/i18n/i18n.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```
git add apps/web/src/i18n apps/web/tsconfig.json
git commit -m "feat(i18n): add i18next core, catalogs, and useLang hook"
```

---

### Task 2: Mount the provider in main.tsx

**Files:**
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Import the i18n init before render**

Edit `apps/web/src/main.tsx` — add the import (side-effect import runs `i18n.init`):
```ts
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./lib/query-client";
import "./i18n";
import "./theme/global.css";
```
No other change — `initReactI18next` wires React context globally, so no extra `<Provider>` element is required.

- [ ] **Step 2: Verify build**

Run:
```
pnpm --filter @acm/web build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```
git add apps/web/src/main.tsx
git commit -m "feat(i18n): initialize i18n at app bootstrap"
```

---

### Task 3: Language toggle in Settings

**Files:**
- Modify: `apps/web/src/screens/Settings.tsx`
- Test: `apps/web/e2e/i18n.spec.ts` (created in Task 16; the toggle must carry a stable `data-testid`)

- [ ] **Step 1: Add a "Preferencias" section to the SideNav and a language panel**

In `apps/web/src/screens/Settings.tsx`:

Extend the `Section` type:
```ts
type Section = "members" | "pricing" | "preferences";
```

Add a SideNav item (inside the `items` array, after "Precios de modelos"):
```tsx
{ label: t("settings.preferences"), active: section === "preferences", onClick: () => setSection("preferences") },
```

Add the panel (after the `pricing` section block):
```tsx
{section === "preferences" && (
  <Panel title={t("settings.language")}>
    <div style={{ display: "flex", gap: 8 }} data-testid="lang-toggle">
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          data-testid={`lang-${l}`}
          style={{
            ...inputStyle,
            cursor: "pointer",
            borderColor: lang === l ? colors.coral : colors.border,
            color: lang === l ? colors.coral : colors.text,
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  </Panel>
)}
```

Wire the hook + translation at the top of the component body:
```ts
const { t } = useTranslation();
const { lang, setLang, langs } = useLang();
```

Add imports:
```ts
import { useTranslation } from "react-i18next";
import { useLang } from "../i18n/use-lang";
```

- [ ] **Step 2: Add the keys to both catalogs**

In `es.json` add under a new `settings` namespace:
```json
"settings": {
  "preferences": "Preferencias",
  "language": "Idioma"
}
```
In `en.json`:
```json
"settings": {
  "preferences": "Preferences",
  "language": "Language"
}
```

- [ ] **Step 3: Verify build + manual smoke**

Run:
```
pnpm --filter @acm/web build
```
Expected: build succeeds. (Full E2E added in Task 16.)

- [ ] **Step 4: Commit**

```
git add apps/web/src/screens/Settings.tsx apps/web/src/i18n/locales
git commit -m "feat(i18n): add language toggle in Settings"
```

---

### Tasks 4–15: Migrate screens & components to `t()`

> **Migration rule (applies to every task below):** the current Spanish literal is the
> source. Copy it verbatim into `es.json` under the file's namespace, add the English
> translation to `en.json`, then replace the literal with `t('namespace.key')`. Do not
> reword. Keep one namespace per screen and reuse `common.*` for shared labels.
>
> **Per-task loop (same five steps every time):**
> 1. Read the file; list every visible Spanish literal (JSX text nodes, `title`/`label`/
>    `placeholder`/`caption`/`breadcrumb`/`status` props, `aria-label`, button text).
> 2. Add keys to `es.json` (verbatim) and `en.json` (translated).
> 3. Add `const { t } = useTranslation();` and replace each literal with `t('ns.key')`.
>    For interpolated text use `t('ns.key', { var })` with `{{var}}` in the catalog.
> 4. Run `pnpm --filter @acm/web build` → expect success.
> 5. Commit: `git commit -m "feat(i18n): localize <file>"`.

**Namespacing map (one namespace per source file):**

| Task | File | Namespace |
|------|------|-----------|
| 4 | `screens/Cabina.tsx` | `cabina` |
| 5 | `screens/Projects.tsx` + `screens/ProjectDetail.tsx` | `projects` |
| 6 | `screens/Costs.tsx` | `costs` |
| 7 | `screens/Reports.tsx` | `reports` |
| 8 | `screens/Tracker.tsx` | `tracker` |
| 9 | `screens/Documents.tsx` + `features/documents/components/ProjectDocuments.tsx` | `documents` |
| 10 | `screens/Notifications.tsx` | `notifications` |
| 11 | `screens/Mcp.tsx` + `features/mcp/components/McpConnectGuide.tsx` + `features/mcp/components/McpEndpointPanel.tsx` | `mcp` |
| 12 | `screens/Auth.tsx` | `auth` |
| 13 | `screens/Settings.tsx` (remaining strings) + `features/model-pricing/components/ModelPriceList.tsx` + `features/model-pricing/components/ModelPriceRow.tsx` | `settings` |
| 14 | `components/Chrome/Chrome.tsx` (NAV labels, breadcrumb/status defaults) + `App.tsx` (CommandPalette command labels) + `components/CommandPalette/CommandPalette.tsx` | `nav` / `palette` |
| 15 | `components/McpStream/McpStream.tsx` + `components/StackedBars/StackedBars.tsx` + `features/projects/components/ProjectEstimatePanel.tsx` + `features/reporting/components/ProjectMarginPanel.tsx` + `features/reporting/components/ProjectTeam.tsx` + `features/time-entries/components/ProjectTimeline.tsx` + `features/time-entries/components/TimeEntryModal.tsx` | `common` + per-feature keys |

#### Worked example (Task 4 — Cabina) — follow this shape for Tasks 5–15

**Files:**
- Modify: `apps/web/src/screens/Cabina.tsx`
- Modify: `apps/web/src/i18n/locales/es.json`, `apps/web/src/i18n/locales/en.json`

- [ ] **Step 1: Add keys to catalogs**

`es.json` → add:
```json
"cabina": {
  "breadcrumb": "FLIGHT DECK · cabina",
  "status": "SYSTEMS NOMINAL",
  "ofTarget": "del objetivo",
  "today": "Hoy",
  "week": "Semana",
  "tracked": "trackeado",
  "ofForty": "de 40h",
  "billable": "Facturable",
  "margin": "Margen",
  "noActiveTask": "Sin tarea activa",
  "pickProject": "elige un proyecto para registrar tiempo"
}
```
`en.json` → add:
```json
"cabina": {
  "breadcrumb": "FLIGHT DECK · cockpit",
  "status": "SYSTEMS NOMINAL",
  "ofTarget": "of target",
  "today": "Today",
  "week": "Week",
  "tracked": "tracked",
  "ofForty": "of 40h",
  "billable": "Billable",
  "margin": "Margin",
  "noActiveTask": "No active task",
  "pickProject": "pick a project to track time"
}
```

- [ ] **Step 2: Replace literals in `Cabina.tsx`**

Add `import { useTranslation } from "react-i18next";` and `const { t } = useTranslation();` in the component body. Then replace, e.g.:
```tsx
<Chrome breadcrumb={t("cabina.breadcrumb")} status={t("cabina.status")}>
...
<RingGauge total={cost} target={2400} aiFraction={0} caption={t("cabina.ofTarget")} size={isMobile ? 200 : 260} />
...
{ label: t("cabina.today"), value: today ? hm(today.trackedMinutes) : "—", sub: t("cabina.tracked") },
{ label: t("cabina.week"), value: "—", sub: t("cabina.ofForty") },
{ label: t("cabina.billable"), value: today ? hm(today.billableMinutes) : "—", accent: colors.green },
{ label: t("cabina.margin"), value: "—", sub: "Helios", accent: colors.amber },
...
taskTitle={t("cabina.noActiveTask")}
meta={t("cabina.pickProject")}
```
(`"Helios"` is sample data, not UI chrome — leave as-is.)

- [ ] **Step 3: Build**

Run: `pnpm --filter @acm/web build` → Expected: success.

- [ ] **Step 4: Commit**

```
git add apps/web/src/screens/Cabina.tsx apps/web/src/i18n/locales
git commit -m "feat(i18n): localize Cabina screen"
```

> Tasks 5–15: repeat the worked-example loop for each file in the namespacing map above.
> Each task = read file → add verbatim `es` keys + `en` translations → replace literals
> with `t()` → build → commit. Keep commits one-per-task for reviewability.

---

### Task 16: Completeness check + E2E

**Files:**
- Create: `apps/web/e2e/i18n.spec.ts`
- Verify: no residual Spanish UI literals

- [ ] **Step 1: Grep for residual Spanish UI literals**

Run (PowerShell, from `apps/web`):
```
pnpm --filter @acm/web exec tsc --noEmit
```
Then search for leftover literals (allow catalogs + code identifiers):
```
git grep -nE "(>[^<>{}]*[áéíóúñ¿¡][^<>{}]*<)|(\"[^\"]*[áéíóúñ¿¡][^\"]*\")" -- "apps/web/src/**/*.tsx"
```
Expected: no matches outside intentional sample data (e.g. person names). Any match in chrome/labels/buttons must be migrated before proceeding.

- [ ] **Step 2: Write the E2E spec**

`apps/web/e2e/i18n.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("defaults to Spanish and switches to English", async ({ page }) => {
  await page.goto("/settings");
  // default language is Spanish: the Settings nav shows the Spanish label
  await expect(page.getByText("Miembros & tarifas")).toBeVisible();

  // open Preferences and switch to English
  await page.getByText("Preferencias").click();
  await page.getByTestId("lang-en").click();

  // a known chrome label is now English
  await expect(page.getByText("Members & rates")).toBeVisible();

  // persists across reload
  await page.reload();
  await expect(page.getByText("Members & rates")).toBeVisible();
});

test("language preference is stored in localStorage", async ({ page }) => {
  await page.goto("/settings");
  await page.getByText("Preferencias").click();
  await page.getByTestId("lang-en").click();
  const stored = await page.evaluate(() => localStorage.getItem("acm.lang"));
  expect(stored).toBe("en");
});
```
> Note: `"Members & rates"` must be the exact `en.json` translation of `"Miembros & tarifas"` from Task 13. If you chose a different English wording, update the assertion to match.

- [ ] **Step 3: Run the new spec (stack must be up on :5173/:4000)**

Run:
```
pnpm --filter @acm/web e2e i18n.spec.ts
```
Expected: 2 tests PASS.

- [ ] **Step 4: Run the full E2E suite, fix Spanish-coupled assertions**

Run:
```
pnpm --filter @acm/web e2e
```
Expected: all specs green. If a pre-existing spec asserts a Spanish string that now depends on language, either (a) it runs at default `es` so it still passes, or (b) update it to a stable `data-testid`. Default is `es`, so most should pass unchanged.

- [ ] **Step 5: Commit**

```
git add apps/web/e2e/i18n.spec.ts
git commit -m "test(i18n): e2e for language default, switch, and persistence"
```

---

### Task 17: Open PR

- [ ] **Step 1: Push and open PR**

Run:
```
git push -u origin feat/i18n-es-en
gh pr create --title "feat(i18n): Spanish/English internationalization" --body "Full UI i18n (es/en) with Settings toggle, default es, localStorage persistence. Covers all 26 screens/components. Closes the i18n gap from the 2026-06-11 design spec."
```

- [ ] **Step 2: Wait for CI; merge on green**

Run:
```
gh pr checks --watch
gh pr merge --squash
```
Expected: `build-test-e2e` green, squash-merged into `main`.

---

## Self-review notes

- **Spec coverage:** library (Task 1), default es + localStorage + navigator detection
  (Task 1 init), Settings toggle (Task 3), total coverage of all 26 files (Tasks 4–15
  map + Task 16 grep), new E2E + 19 existing green (Task 16). ✓
- **No placeholders:** core code, hook, provider mount, toggle, and one fully worked
  migration task (Cabina) are shown in full. Tasks 5–15 are mechanical repeats of the
  worked example over an explicit file/namespace map — the loop and an exemplar are
  concrete, not "TBD". ✓
- **Type consistency:** `Lang`, `SUPPORTED_LANGS`, `useLang()` ({ lang, setLang, langs })
  used identically in Tasks 1 and 3. `acm.lang` storage key consistent in init, hook,
  and E2E. ✓
