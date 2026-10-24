---
name: add-frontend-feature
description: Canonical recipe for adding or extending a React feature in apps/web — reactive (TanStack Query + Zustand), decoupled reusable components, theme tokens. Use whenever building a screen, data flow, or component in the frontend so structure and reactivity are never improvised.
---

# Add a frontend feature (reactive + decoupled)

Follow in order. Reuse before creating at every step.

## 0. Reuse check
Grep `src/components/` for a primitive to reuse/extend (Panel, Chrome, Gauge, Timer, Button…). Grep `src/features/<feature>/api` for an existing hook. Extend via props — never duplicate.

## 1. Data hooks (server state — TanStack Query)
`features/<feature>/api/use-<feature>.ts`:
```typescript
export function use<Features>() {
  return useQuery({ queryKey: ["<features>"], queryFn: () => apiClient.get<<Type>[]>("/<features>") });
}
export function useCreate<Feature>() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Create<Feature>Dto) => apiClient.post<<Type>>("/<features>", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["<features>"] }),
  });
}
```
Types from `@acm/shared`. Mutations always invalidate the affected queryKey → reactive UI.

## 2. UI state (Zustand — only if needed)
`features/<feature>/store/<feature>.store.ts` for ephemeral client state (timer running, modal open, filters). Never put server data here. Components read via selectors.

## 3. Reusable components (presentational)
If a piece of UI will be used by 2+ features, put it in `components/<Component>/`. It takes props, returns JSX, does NOT fetch and does NOT import TanStack Query. Style with `theme/tokens.ts`. Accessible markup.

## 4. Feature components (composition)
`features/<feature>/components/` compose primitives + hooks. These may use the data hooks from step 1.

## 5. Screen
`screens/<Feature>.tsx` composes feature components inside `<Chrome breadcrumb=...>`. Add the route in `App.tsx` (routes only).

## 6. Verify reactivity
Confirm: creating/updating data re-renders the list without a manual refresh (queryKey invalidation works). No `useEffect`+`fetch` for server data anywhere.

## 7. Review
Hand the diff to the **code-reviewer** agent. Fix every VIOLATION before commit.
