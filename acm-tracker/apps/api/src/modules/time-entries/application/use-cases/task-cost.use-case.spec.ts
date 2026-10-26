import { TaskCostUseCase } from "./task-cost.use-case";
import type { TimeEntry } from "@acm/shared";
import {
  CreateTimeEntryData,
  ProjectEntryView,
  TimeEntryRepositoryPort,
  TodayEntryView,
} from "../../domain/ports/time-entry.repository.port";

const entry = (memberId: string, minutes: number, rate: number): TimeEntry => ({
  id: `${memberId}-${minutes}`,
  taskId: "t1",
  memberId,
  origin: "mcp",
  minutes,
  billable: true,
  ratePerHourSnapshot: rate,
  note: null,
  startedAt: "2026-10-26T16:00:00.000Z",
  createdAt: "2026-10-26T16:00:00.000Z",
});

class FakeEntryRepo implements TimeEntryRepositoryPort {
  async create(_data: CreateTimeEntryData): Promise<TimeEntry> {
    throw new Error("not used");
  }
  async findByTask(): Promise<TimeEntry[]> {
    return [entry("agent", 22, 0), entry("owner", 26, 60), entry("wait", 354, 0)];
  }
  async waitingMemberIds(): Promise<string[]> {
    return ["wait"];
  }
  async findByProject(): Promise<ProjectEntryView[]> {
    return [];
  }
  async findToday(): Promise<TodayEntryView[]> {
    return [];
  }
}

describe("TaskCostUseCase", () => {
  it("keeps waiting time out of the worked minutes and reports it separately", async () => {
    const result = await new TaskCostUseCase(new FakeEntryRepo()).execute("t1");
    expect(result).toEqual({ minutes: 48, waitMinutes: 354, total: 26, billable: 26 });
  });
});
