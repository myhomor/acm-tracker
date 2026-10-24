import { ListProjectEntriesUseCase } from "./list-project-entries.use-case";
import type { TimeEntry } from "@acm/shared";
import {
  ProjectEntryView,
  TimeEntryRepositoryPort,
  TodayEntryView,
} from "../../domain/ports/time-entry.repository.port";

const entry: ProjectEntryView = {
  id: "e1",
  startedAt: "2026-06-08T09:30:00.000Z",
  origin: "manual",
  taskId: "t1",
  taskCode: "API-1",
  taskTitle: "Wire endpoint",
  memberId: "m1",
  memberName: "Ada",
  note: null,
  minutes: 45,
  cost: 36.5,
};

class FakeEntryRepo implements TimeEntryRepositoryPort {
  public lastProjectId?: string;
  async create(): Promise<TimeEntry> {
    throw new Error("not used");
  }
  async findByTask(): Promise<TimeEntry[]> {
    return [];
  }
  async findByProject(projectId: string): Promise<ProjectEntryView[]> {
    this.lastProjectId = projectId;
    return [entry];
  }
  async findToday(): Promise<TodayEntryView[]> {
    return [];
  }
}

describe("ListProjectEntriesUseCase", () => {
  it("returns the project entry views for the given project", async () => {
    const repo = new FakeEntryRepo();
    const useCase = new ListProjectEntriesUseCase(repo);
    const result = await useCase.execute("p1");
    expect(repo.lastProjectId).toBe("p1");
    expect(result).toEqual([entry]);
  });
});
