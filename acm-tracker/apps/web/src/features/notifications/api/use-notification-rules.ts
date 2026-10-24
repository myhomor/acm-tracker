import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationRule } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

export function useNotificationRules() {
  return useQuery({
    queryKey: ["notification-rules"],
    queryFn: () => apiClient.get<NotificationRule[]>("/notification-rules"),
  });
}

export function useCreateNotificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { event: string; condition: string; channel: string }) =>
      apiClient.post<NotificationRule>("/notification-rules", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-rules"] }),
  });
}

export function useToggleNotificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.patch<NotificationRule>(`/notification-rules/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-rules"] }),
  });
}

export function useDeleteNotificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.del<void>(`/notification-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-rules"] }),
  });
}
