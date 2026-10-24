# apps/web — Frontend (React + Vite, reactive)

Reactive by default. Decoupled, reusable components. Never re-create what exists.

## Structure

```
src/
├── components/            # REUSABLE, presentational, decoupled from data.
│   └── <Component>/       # one folder per component if it has variants/subparts
│       └── <Component>.tsx
│       └── index.ts
├── features/<feature>/    # feature-scoped logic
│   ├── api/               # query/mutation hooks (TanStack Query)
│   │   └── use-<thing>.ts # useProjects(), useCreateProject(), ...
│   ├── components/        # feature-specific composition (uses /components primitives)
│   └── store/             # Zustand slice if the feature has UI state
├── lib/
│   ├── api-client.ts      # typed fetch wrapper (one place)
│   └── query-client.ts    # TanStack QueryClient config
├── theme/                 # tokens + global css (Flight Deck)
├── screens/               # route-level pages, compose features + components
└── App.tsx                # routes only
```

## Reactivity (mandatory)

- **Server state = TanStack Query.** All fetching through `useQuery`/`useMutation` hooks under `features/<feature>/api`. Mutations call `queryClient.invalidateQueries` so the UI updates reactively. No manual `useEffect` + `fetch` for server data. No re-fetch by hand.
- **UI state = Zustand.** Only ephemeral client state (running timer, open modal, filters). One small slice per concern. No server data in Zustand.
- Components subscribe to exactly the state they need (selectors). No prop-drilling more than 1 level — lift to a hook or store.

## Component rules

- `components/` are **dumb**: props in, JSX out. They never fetch, never know about TanStack Query. This is what makes them reusable across features.
- A component used by 2+ features lives in `components/`. Feature-only composition lives in `features/<feature>/components`.
- Before creating a component, check `components/` for one to reuse or extend. Extend via props/variants, not by copy-paste.
- Style with theme tokens (`theme/tokens.ts`). No hardcoded hex/spacing.
- Accessibility: semantic elements, labels, keyboard focus.

## Data hook pattern

```typescript
// features/projects/api/use-projects.ts
export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: () => apiClient.get<Project[]>("/projects") });
}
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProjectDto) => apiClient.post<Project>("/projects", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
```

Screens consume hooks; components stay presentational. Types come from `@acm/shared`.
