import { Inject, Injectable } from "@nestjs/common";
import {
  TIME_ENTRY_REPOSITORY,
  TimeEntryRepositoryPort,
  TodayEntryView,
} from "../../domain/ports/time-entry.repository.port";

@Injectable()
export class ListTodayEntriesUseCase {
  constructor(@Inject(TIME_ENTRY_REPOSITORY) private readonly repo: TimeEntryRepositoryPort) {}

  execute(from: Date, to: Date): Promise<TodayEntryView[]> {
    return this.repo.findToday(from, to);
  }
}
