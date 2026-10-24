import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import type { TimeEntry } from "@acm/shared";
import { StartTimerUseCase } from "./start-timer.use-case";
import { StopTimerUseCase } from "./stop-timer.use-case";
import { ActiveTimerView, TimerSessionPort } from "../../domain/ports/timer-session.port";
import {
  CreateTimeEntryData,
  ProjectEntryView,
  TimeEntryRepositoryPort,
  TodayEntryView,
} from "../../../time-entries/domain/ports/time-entry.repository.port";

class FakeSessions implements TimerSessionPort {
  public active: ActiveTimerView | null = null;
  public cleared = false;
  public taskKnown = true;
  async findActive(): Promise<ActiveTimerView | null> { return this.active; }
  async create(_memberId: string, taskId: string): Promise<void> {
    this.active = { taskId, taskCode: "T-1", taskTitle: "t", projectName: "p", ratePerHour: 45, startedAt: new Date().toISOString() };
  }
  async clear(): Promise<number> { const had = this.active ? 1 : 0; this.active = null; this.cleared = true; return had; }
  async taskExists(): Promise<boolean> { return this.taskKnown; }
}

class FakeEntries implements TimeEntryRepositoryPort {
  public lastCreate?: CreateTimeEntryData;
  async create(data: CreateTimeEntryData): Promise<TimeEntry> {
    this.lastCreate = data;
    return {
      id: "e1", origin: data.origin ?? "manual", createdAt: "now",
      taskId: data.taskId, memberId: data.memberId, minutes: data.minutes,
      billable: data.billable, ratePerHourSnapshot: data.ratePerHourSnapshot,
      note: data.note, startedAt: data.startedAt.toISOString(),
    };
  }
  async findByTask(): Promise<TimeEntry[]> { return []; }
  async findByProject(): Promise<ProjectEntryView[]> { return []; }
  async findToday(): Promise<TodayEntryView[]> { return []; }
}

function activeStartedAgo(ms: number): ActiveTimerView {
  return {
    taskId: "t1", taskCode: "T-1", taskTitle: "Task", projectName: "Helios",
    ratePerHour: 45, startedAt: new Date(Date.now() - ms).toISOString(),
  };
}

describe("StartTimerUseCase", () => {
  it("creates a session when none is active", async () => {
    const sessions = new FakeSessions();
    const entries = new FakeEntries();
    const useCase = new StartTimerUseCase(sessions, new StopTimerUseCase(sessions, entries));
    const view = await useCase.execute("m1", "task-9");
    expect(view.taskId).toBe("task-9");
    expect(entries.lastCreate).toBeUndefined();
  });

  it("auto-stops and logs the previous timer before starting a new one", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(300_000);
    const entries = new FakeEntries();
    const useCase = new StartTimerUseCase(sessions, new StopTimerUseCase(sessions, entries));
    const view = await useCase.execute("m1", "task-9");
    expect(entries.lastCreate?.taskId).toBe("t1");
    expect(entries.lastCreate?.origin).toBe("timer");
    expect(view.taskId).toBe("task-9");
  });

  it("throws NotFound for an unknown task", async () => {
    const sessions = new FakeSessions();
    sessions.taskKnown = false;
    const entries = new FakeEntries();
    const useCase = new StartTimerUseCase(sessions, new StopTimerUseCase(sessions, entries));
    await expect(useCase.execute("m1", "nope")).rejects.toThrow(NotFoundException);
  });

  it("throws InternalServerError when session cannot be read back after create", async () => {
    const sessions = new FakeSessions();
    sessions.active = null;
    const brokenSessions: TimerSessionPort = {
      findActive: async () => null,
      create: async () => {},
      clear: async () => 0,
      taskExists: async () => true,
    };
    const entries = new FakeEntries();
    const useCase = new StartTimerUseCase(brokenSessions, new StopTimerUseCase(brokenSessions, entries));
    await expect(useCase.execute("m1", "t1")).rejects.toThrow(InternalServerErrorException);
  });
});
