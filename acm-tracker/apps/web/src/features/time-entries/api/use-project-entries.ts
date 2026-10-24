import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

export interface ProjectEntryView {
  id: string;
  startedAt: string;
  origin: string;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  memberId: string;
  memberName: string;
  note: string | null;
  minutes: number;
  cost: number;
}

export function useProjectEntries(projectId: string) {
  return useQuery({
    queryKey: ["project-entries", projectId],
    queryFn: () => apiClient.get<ProjectEntryView[]>(`/time-entries/project/${projectId}`),
    enabled: Boolean(projectId),
  });
}
