import { Inject, Injectable } from "@nestjs/common";
import type { TimeEntry } from "@acm/shared";
import {
  TIME_ENTRY_REPOSITORY,
  TimeEntryRepositoryPort,
} from "../../domain/ports/time-entry.repository.port";

@Injectable()
export class ListTaskEntriesUseCase {
  constructor(@Inject(TIME_ENTRY_REPOSITORY) private readonly repo: TimeEntryRepositoryPort) {}

  execute(taskId: string): Promise<TimeEntry[]> {
    return this.repo.findByTask(taskId);
  }
}
