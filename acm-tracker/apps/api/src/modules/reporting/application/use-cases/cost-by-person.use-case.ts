import { Inject, Injectable } from "@nestjs/common";
import type { PersonCost } from "@acm/shared";
import { COST_AGGREGATION, CostAggregationPort } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class CostByPersonUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  execute(projectId?: string): Promise<PersonCost[]> {
    return this.agg.costByPerson(projectId);
  }
}
