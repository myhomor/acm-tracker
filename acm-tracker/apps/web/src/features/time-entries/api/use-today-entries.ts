import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

export interface TodayEntryView {
  id: string;
  time: string;
  origin: string;
  taskCode: string;
  taskTitle: string;
  memberName: string;
  note: string | null;
  minutes: number;
  cost: number;
  aiCost: number;
}

export function useTodayEntries() {
  return useQuery({
    queryKey: ["today-entries"],
    queryFn: () => apiClient.get<TodayEntryView[]>("/time-entries/today"),
  });
}

export function useDayEntries(date: string) {
  return useQuery({
    queryKey: ["day-entries", date],
    queryFn: () => apiClient.get<TodayEntryView[]>(`/time-entries/day?date=${date}`),
  });
}
