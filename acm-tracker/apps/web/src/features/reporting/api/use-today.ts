import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

export interface TodaySummary {
  trackedMinutes: number;
  billableMinutes: number;
  cost: number;
  aiCost: number;
  weekMinutes: number;
}

export interface MarginSummary {
  revenue: number;
  cost: number;
  margin: number;
  projectCount: number;
}

export function useMarginSummary() {
  return useQuery({
    queryKey: ["margin-summary"],
    queryFn: () => apiClient.get<MarginSummary>("/reports/margin-summary"),
  });
}

export interface TeamTodayRow {
  memberId: string;
  name: string;
  initials: string;
  trackedMinutes: number;
  cost: number;
}

export function useTodaySummary() {
  return useQuery({
    queryKey: ["today-summary"],
    queryFn: () => apiClient.get<TodaySummary>("/reports/today"),
  });
}

export function useTeamToday() {
  return useQuery({
    queryKey: ["team-today"],
    queryFn: () => apiClient.get<TeamTodayRow[]>("/reports/team-today"),
  });
}
