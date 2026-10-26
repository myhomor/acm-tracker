import { MarginSummaryUseCase } from "./margin-summary.use-case";
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
    return { trackedMinutes: 0, billableMinutes: 0, cost: 0, aiCost: 0, weekMinutes: 0, waitMinutes: 0 };
  }
  async teamToday(): Promise<TeamTodayRow[]> {
    return [];
  }
  async marginSummary(): Promise<MarginSummary> {
    return { revenue: 800, cost: 450, margin: 350, projectCount: 1 };
  }
}

describe("MarginSummaryUseCase", () => {
  it("returns the margin summary verbatim from the aggregation port", async () => {
    const useCase = new MarginSummaryUseCase(new FakeAgg());
    const r = await useCase.execute();
    expect(r).toEqual({ revenue: 800, cost: 450, margin: 350, projectCount: 1 });
  });
});
