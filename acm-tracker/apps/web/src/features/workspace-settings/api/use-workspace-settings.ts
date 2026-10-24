import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

export interface WorkspaceSettings {
  dailyCostTarget: number;
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: ["workspace-settings"],
    queryFn: () => apiClient.get<WorkspaceSettings>("/workspace-settings"),
  });
}

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<WorkspaceSettings>) => apiClient.patch<WorkspaceSettings>("/workspace-settings", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-settings"] }),
  });
}
