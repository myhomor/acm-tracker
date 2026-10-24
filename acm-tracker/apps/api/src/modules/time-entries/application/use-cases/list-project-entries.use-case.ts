import { Inject, Injectable } from "@nestjs/common";
import {
  ProjectEntryView,
  TIME_ENTRY_REPOSITORY,
  TimeEntryRepositoryPort,
} from "../../domain/ports/time-entry.repository.port";

@Injectable()
export class ListProjectEntriesUseCase {
  constructor(@Inject(TIME_ENTRY_REPOSITORY) private readonly repo: TimeEntryRepositoryPort) {}

  execute(projectId: string): Promise<ProjectEntryView[]> {
    return this.repo.findByProject(projectId);
  }
}
