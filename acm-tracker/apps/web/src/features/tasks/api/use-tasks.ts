import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", { projectId }],
    queryFn: () => apiClient.get<Task[]>(`/tasks?projectId=${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { code: string; title: string; phase?: string; estimateMinutes?: number }) =>
      apiClient.post<Task>("/tasks", { ...dto, projectId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", { projectId }] }),
  });
}
