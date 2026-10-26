import { Inject, Injectable } from "@nestjs/common";
import { sumCost, type TaskCostSummary } from "@acm/shared";
import {
  TIME_ENTRY_REPOSITORY,
  TimeEntryRepositoryPort,
} from "../../domain/ports/time-entry.repository.port";

@Injectable()
export class TaskCostUseCase {
  constructor(@Inject(TIME_ENTRY_REPOSITORY) private readonly repo: TimeEntryRepositoryPort) {}

  async execute(taskId: string): Promise<TaskCostSummary> {
    const [entries, waitingIds] = await Promise.all([this.repo.findByTask(taskId), this.repo.waitingMemberIds()]);
    const waiting = new Set(waitingIds);
    const worked = entries.filter((e) => !waiting.has(e.memberId));
    const waitMinutes = entries.filter((e) => waiting.has(e.memberId)).reduce((s, e) => s + e.minutes, 0);
    return { ...sumCost(worked), waitMinutes };
  }
}
