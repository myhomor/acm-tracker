import { MutationCache, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({ onError: (error) => console.error(error) }),
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: false },
  },
});
