import { Inject, Injectable } from "@nestjs/common";
import type { WeeklyCost } from "@acm/shared";
import { COST_AGGREGATION, CostAggregationPort } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class WeeklyCostSeriesUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  execute(weeks = 8, projectId?: string): Promise<WeeklyCost[]> {
    return this.agg.weeklyCost(weeks, projectId);
  }
}
