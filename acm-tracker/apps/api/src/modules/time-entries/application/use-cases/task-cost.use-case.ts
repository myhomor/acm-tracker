import { Inject, Injectable } from "@nestjs/common";
import { sumCost, type CostSummary } from "@acm/shared";
import {
  TIME_ENTRY_REPOSITORY,
  TimeEntryRepositoryPort,
} from "../../domain/ports/time-entry.repository.port";

@Injectable()
export class TaskCostUseCase {
  constructor(@Inject(TIME_ENTRY_REPOSITORY) private readonly repo: TimeEntryRepositoryPort) {}

  async execute(taskId: string): Promise<CostSummary> {
    const entries = await this.repo.findByTask(taskId);
    return sumCost(entries);
  }
}
