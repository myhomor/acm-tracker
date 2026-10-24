import { Inject, Injectable } from "@nestjs/common";
import { COST_AGGREGATION, CostAggregationPort, TodaySummary } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class TodaySummaryUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  execute(from: Date, to: Date, weekFrom: Date): Promise<TodaySummary> {
    return this.agg.todaySummary(from, to, weekFrom);
  }
}
