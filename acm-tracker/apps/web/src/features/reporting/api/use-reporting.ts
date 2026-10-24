import { useQuery } from "@tanstack/react-query";
import type { DailyReport, PersonCost, WeeklyCost } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

interface ProjectCost {
  human: number;
  ai: number;
  total: number;
  minutes: number;
  estimateHours: number | null;
  projectRate: number | null;
  estimatedCost: number | null;
  revenue: number | null;
  margin: number | null;
  marginPerHour: number | null;
}

export function useProjectCost(projectId: string) {
  return useQuery({
    queryKey: ["project-cost", projectId],
    queryFn: () => apiClient.get<ProjectCost>(`/projects/${projectId}/cost`),
    enabled: Boolean(projectId),
  });
}

const projectQuery = (projectId?: string) => (projectId ? `projectId=${encodeURIComponent(projectId)}` : "");

export function useCostByPerson(projectId?: string) {
  return useQuery({
    queryKey: ["cost-by-person", projectId ?? "all"],
    queryFn: () => apiClient.get<PersonCost[]>(`/reports/by-person?${projectQuery(projectId)}`),
  });
}

export function useDailyReport(projectId?: string, days = 30) {
  return useQuery({
    queryKey: ["daily-report", projectId ?? "all", days],
    queryFn: () => apiClient.get<DailyReport[]>(`/reports/daily?days=${days}&${projectQuery(projectId)}`),
  });
}

export function useProjectTeam(projectId: string) {
  return useQuery({
    queryKey: ["project-team", projectId],
    queryFn: () => apiClient.get<PersonCost[]>(`/reports/by-person?projectId=${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useWeeklyCost(projectId?: string) {
  return useQuery({
    queryKey: ["weekly-cost", projectId ?? "all"],
    queryFn: () => apiClient.get<WeeklyCost[]>(`/reports/weekly?${projectQuery(projectId)}`),
  });
}
