import { CostByPersonUseCase } from "./cost-by-person.use-case";
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
  public lastProjectId: string | undefined = undefined;
  async projectCost(): Promise<ProjectCostRow> {
    return { human: 0, ai: 0, minutes: 0 };
  }
  async projectEstimate(): Promise<ProjectEstimateRow> {
    return { estimateHours: null, ratePerHour: null };
  }
  async costByPerson(projectId?: string): Promise<PersonCost[]> {
    this.lastProjectId = projectId;
    return [{ memberId: "m1", name: "Ada", minutes: 60, human: 50, ai: 0, total: 50 }];
  }
  async weeklyCost(): Promise<WeeklyCost[]> {
    return [];
  }
  async dailyEntries(): Promise<DailyEntryRow[]> {
    return [];
  }
  async todaySummary(): Promise<TodaySummary> {
    return { trackedMinutes: 0, billableMinutes: 0, cost: 0, aiCost: 0, weekMinutes: 0 };
  }
  async teamToday(): Promise<TeamTodayRow[]> {
    return [];
  }
  async marginSummary(): Promise<MarginSummary> {
    return { revenue: 0, cost: 0, margin: 0, projectCount: 0 };
  }
}

describe("CostByPersonUseCase", () => {
  it("aggregates globally when no projectId is given", async () => {
    const agg = new FakeAgg();
    const useCase = new CostByPersonUseCase(agg);
    const result = await useCase.execute();
    expect(agg.lastProjectId).toBeUndefined();
    expect(result).toEqual([{ memberId: "m1", name: "Ada", minutes: 60, human: 50, ai: 0, total: 50 }]);
  });

  it("scopes aggregation to the given project", async () => {
    const agg = new FakeAgg();
    const useCase = new CostByPersonUseCase(agg);
    await useCase.execute("p1");
    expect(agg.lastProjectId).toBe("p1");
  });
});
