import { CreateManualEntryUseCase } from "./create-manual-entry.use-case";
import type { TimeEntry } from "@acm/shared";
import {
  CreateTimeEntryData,
  ProjectEntryView,
  TimeEntryRepositoryPort,
  TodayEntryView,
} from "../../domain/ports/time-entry.repository.port";
import { MemberRateReaderPort } from "../../domain/ports/member-rate.port";

class FakeEntryRepo implements TimeEntryRepositoryPort {
  public lastCreate?: CreateTimeEntryData;
  async create(data: CreateTimeEntryData): Promise<TimeEntry> {
    this.lastCreate = data;
    return {
      id: "e1", origin: "manual", createdAt: "now",
      taskId: data.taskId, memberId: data.memberId, minutes: data.minutes,
      billable: data.billable, ratePerHourSnapshot: data.ratePerHourSnapshot,
      note: data.note, startedAt: data.startedAt.toISOString(),
    };
  }
  async findByTask(): Promise<TimeEntry[]> {
    return [];
  }
  async findByProject(): Promise<ProjectEntryView[]> {
    return [];
  }
  async findToday(): Promise<TodayEntryView[]> {
    return [];
  }
}

class FakeRateReader implements MemberRateReaderPort {
  async getRatePerHour(): Promise<number> {
    return 48.5;
  }
}

describe("CreateManualEntryUseCase", () => {
  it("snapshots the member's current rate and defaults billable to true", async () => {
    const repo = new FakeEntryRepo();
    const useCase = new CreateManualEntryUseCase(repo, new FakeRateReader());
    await useCase.execute("m1", { taskId: "t1", minutes: 30 });
    expect(repo.lastCreate?.ratePerHourSnapshot).toBe(48.5);
    expect(repo.lastCreate?.billable).toBe(true);
    expect(repo.lastCreate?.memberId).toBe("m1");
  });
});
