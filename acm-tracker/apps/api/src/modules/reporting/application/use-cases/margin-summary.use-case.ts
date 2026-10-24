import { Inject, Injectable } from "@nestjs/common";
import { COST_AGGREGATION, CostAggregationPort, MarginSummary } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class MarginSummaryUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  execute(): Promise<MarginSummary> {
    return this.agg.marginSummary();
  }
}
