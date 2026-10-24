import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, Task } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

type ProjectWithTasks = Project & { tasks: Task[] };

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.get<Project[]>("/projects"),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => apiClient.get<ProjectWithTasks>(`/projects/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; client?: string; contractAmount?: number }) =>
      apiClient.post<Project>("/projects", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

type UpdateProjectDto = Partial<{
  name: string;
  client: string;
  contractAmount: number;
  estimateHours: number;
  ratePerHour: number;
}>;

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateProjectDto) => apiClient.patch<Project>(`/projects/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", id] });
      qc.invalidateQueries({ queryKey: ["project-cost", id] });
    },
  });
}
