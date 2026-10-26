import { TodaySummaryUseCase } from "./today-summary.use-case";
import type { PersonCost, WeeklyCost } from "@acm/shared";
import {
  CostAggregationPort,
  MarginSummary,
  ProjectCostRow,
  ProjectEstimateRow,
  TeamTodayRow,
  TodaySummary,
} from "../../domain/ports/cost-aggregation.port";
import type { DailyEntryRow } from "../../domain/daily-report";

class FakeAgg implements CostAggregationPort {
  async projectCost(): Promise<ProjectCostRow> {
    return { human: 0, ai: 0, minutes: 0, waitMinutes: 0 };
  }
  async projectEstimate(): Promise<ProjectEstimateRow> {
    return { estimateHours: null, ratePerHour: null };
  }
  async costByPerson(): Promise<PersonCost[]> {
    return [];
  }
  async weeklyCost(): Promise<WeeklyCost[]> {
    return [];
  }
  async dailyEntries(): Promise<DailyEntryRow[]> {
    return [];
  }
  async todaySummary(): Promise<TodaySummary> {
    return { trackedMinutes: 252, billableMinutes: 240, cost: 334, aiCost: 1.5, weekMinutes: 1200, waitMinutes: 90 };
  }
  async teamToday(): Promise<TeamTodayRow[]> {
    return [];
  }
  async marginSummary(): Promise<MarginSummary> {
    return { revenue: 0, cost: 0, margin: 0, projectCount: 0 };
  }
}

describe("TodaySummaryUseCase", () => {
  it("returns the summary from the aggregation port", async () => {
    const useCase = new TodaySummaryUseCase(new FakeAgg());
    const r = await useCase.execute(
      new Date("2026-06-06T00:00:00Z"),
      new Date("2026-06-07T00:00:00Z"),
      new Date("2026-06-02T00:00:00Z"),
    );
    expect(r).toEqual({ trackedMinutes: 252, billableMinutes: 240, cost: 334, aiCost: 1.5, weekMinutes: 1200, waitMinutes: 90 });
  });
});
