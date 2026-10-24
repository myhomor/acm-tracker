import { Inject, Injectable } from "@nestjs/common";
import type { DailyReport } from "@acm/shared";
import { COST_AGGREGATION, CostAggregationPort } from "../../domain/ports/cost-aggregation.port";
import { groupByDay } from "../../domain/daily-report";

@Injectable()
export class DailyReportUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  async execute(from: Date, projectId?: string): Promise<DailyReport[]> {
    return groupByDay(await this.agg.dailyEntries(from, projectId));
  }
}
