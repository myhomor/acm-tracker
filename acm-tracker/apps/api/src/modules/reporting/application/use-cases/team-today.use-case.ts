import { Inject, Injectable } from "@nestjs/common";
import { COST_AGGREGATION, CostAggregationPort, TeamTodayRow } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class TeamTodayUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  execute(from: Date, to: Date): Promise<TeamTodayRow[]> {
    return this.agg.teamToday(from, to);
  }
}
