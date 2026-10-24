import { ProjectCostBreakdownUseCase } from "./project-cost-breakdown.use-case";
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
  constructor(
    private readonly row: ProjectCostRow,
    private readonly estimate: ProjectEstimateRow = { estimateHours: null, ratePerHour: null },
  ) {}
  async projectCost(): Promise<ProjectCostRow> {
    return this.row;
  }
  async projectEstimate(): Promise<ProjectEstimateRow> {
    return this.estimate;
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
    return { trackedMinutes: 0, billableMinutes: 0, cost: 0, aiCost: 0, weekMinutes: 0 };
  }
  async teamToday(): Promise<TeamTodayRow[]> {
    return [];
  }
  async marginSummary(): Promise<MarginSummary> {
    return { revenue: 0, cost: 0, margin: 0, projectCount: 0 };
  }
}

describe("ProjectCostBreakdownUseCase", () => {
  it("returns nulls for estimate and margin when the project has no rate", async () => {
    const useCase = new ProjectCostBreakdownUseCase(new FakeAgg({ human: 1508, ai: 0, minutes: 2010 }));
    const result = await useCase.execute("p1");
    expect(result).toEqual({
      human: 1508,
      ai: 0,
      total: 1508,
      minutes: 2010,
      estimateHours: null,
      projectRate: null,
      estimatedCost: null,
      revenue: null,
      margin: null,
      marginPerHour: null,
    });
  });

  it("computes estimatedCost, revenue and margin against the total cost", async () => {
    const useCase = new ProjectCostBreakdownUseCase(
      new FakeAgg({ human: 1000, ai: 0, minutes: 6000 }, { estimateHours: 120, ratePerHour: 80 }),
    );
    const result = await useCase.execute("p1");
    expect(result.estimateHours).toBe(120);
    expect(result.projectRate).toBe(80);
    expect(result.estimatedCost).toBe(9600);
    expect(result.revenue).toBe(8000);
    expect(result.margin).toBe(7000);
    expect(result.marginPerHour).toBe(70);
  });

  it("includes AI cost in the total and subtracts it from the margin", async () => {
    const useCase = new ProjectCostBreakdownUseCase(
      new FakeAgg({ human: 1000, ai: 250.5, minutes: 6000 }, { estimateHours: null, ratePerHour: 80 }),
    );
    const result = await useCase.execute("p1");
    expect(result.human).toBe(1000);
    expect(result.ai).toBe(250.5);
    expect(result.total).toBe(1250.5);
    expect(result.revenue).toBe(8000);
    expect(result.margin).toBe(6749.5);
  });

  it("leaves estimatedCost null when estimateHours is missing but still computes revenue", async () => {
    const useCase = new ProjectCostBreakdownUseCase(
      new FakeAgg({ human: 500, ai: 0, minutes: 3000 }, { estimateHours: null, ratePerHour: 60 }),
    );
    const result = await useCase.execute("p1");
    expect(result.estimatedCost).toBeNull();
    expect(result.revenue).toBe(3000);
    expect(result.margin).toBe(2500);
    expect(result.marginPerHour).toBe(50);
  });

  it("returns marginPerHour null when there are no tracked hours", async () => {
    const useCase = new ProjectCostBreakdownUseCase(
      new FakeAgg({ human: 0, ai: 0, minutes: 0 }, { estimateHours: 10, ratePerHour: 90 }),
    );
    const result = await useCase.execute("p1");
    expect(result.revenue).toBe(0);
    expect(result.margin).toBe(0);
    expect(result.marginPerHour).toBeNull();
    expect(result.estimatedCost).toBe(900);
  });
});
