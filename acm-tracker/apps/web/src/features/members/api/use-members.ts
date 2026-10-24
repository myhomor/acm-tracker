import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Member } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

const RATE_DEPENDENT_KEYS = [
  ["members"],
  ["team-today"],
  ["cost-by-person"],
  ["project-team"],
  ["project-cost"],
  ["weekly-cost"],
] as const;

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: () => apiClient.get<Member[]>("/members"),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name?: string; email?: string; role?: string; ratePerHour?: number }) =>
      apiClient.patch<Member>(`/members/${id}`, dto),
    onSuccess: () => RATE_DEPENDENT_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
  });
}
