import type { PersonCost, WeeklyCost } from "@acm/shared";
import type { DailyEntryRow } from "../daily-report";

export const COST_AGGREGATION = Symbol("COST_AGGREGATION");

export interface ProjectCostRow {
  human: number;
  ai: number;
  minutes: number;
}

export interface ProjectEstimateRow {
  estimateHours: number | null;
  ratePerHour: number | null;
}

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

export interface TeamTodayRow {
  memberId: string;
  name: string;
  initials: string;
  trackedMinutes: number;
  cost: number;
}

export interface CostAggregationPort {
  projectCost(projectId: string): Promise<ProjectCostRow>;
  projectEstimate(projectId: string): Promise<ProjectEstimateRow>;
  costByPerson(projectId?: string): Promise<PersonCost[]>;
  weeklyCost(weeks: number, projectId?: string): Promise<WeeklyCost[]>;
  dailyEntries(from: Date, projectId?: string): Promise<DailyEntryRow[]>;
  todaySummary(from: Date, to: Date, weekFrom: Date): Promise<TodaySummary>;
  teamToday(from: Date, to: Date): Promise<TeamTodayRow[]>;
  marginSummary(): Promise<MarginSummary>;
}
