import { Inject, Injectable } from "@nestjs/common";
import { breakdownCost } from "@acm/shared";
import { COST_AGGREGATION, CostAggregationPort } from "../../domain/ports/cost-aggregation.port";

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface ProjectCostBreakdown {
  human: number;
  ai: number;
  total: number;
  minutes: number;
  waitMinutes: number;
  estimateHours: number | null;
  projectRate: number | null;
  estimatedCost: number | null;
  revenue: number | null;
  margin: number | null;
  marginPerHour: number | null;
}

@Injectable()
export class ProjectCostBreakdownUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  async execute(projectId: string): Promise<ProjectCostBreakdown> {
    const [row, estimate] = await Promise.all([
      this.agg.projectCost(projectId),
      this.agg.projectEstimate(projectId),
    ]);
    const breakdown = breakdownCost(row.human, row.ai);
    const { estimateHours, ratePerHour } = estimate;

    const estimatedCost =
      estimateHours != null && ratePerHour != null ? round2(estimateHours * ratePerHour) : null;

    const hours = row.minutes / 60;
    const revenue = ratePerHour != null ? round2(hours * ratePerHour) : null;
    const margin = revenue != null ? round2(revenue - breakdown.total) : null;
    const marginPerHour = margin != null && hours > 0 ? round2(margin / hours) : null;

    return {
      ...breakdown,
      minutes: row.minutes,
      waitMinutes: row.waitMinutes,
      estimateHours,
      projectRate: ratePerHour,
      estimatedCost,
      revenue,
      margin,
      marginPerHour,
    };
  }
}
