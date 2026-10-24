import { NotFoundException } from "@nestjs/common";
import type { TimeEntry } from "@acm/shared";
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
  public createCalls = 0;
  async create(data: CreateTimeEntryData): Promise<TimeEntry> {
    this.createCalls++;
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

describe("StopTimerUseCase", () => {
  it("logs a timer entry with elapsed minutes and clears the session", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(125_000);
    const entries = new FakeEntries();
    const useCase = new StopTimerUseCase(sessions, entries);
    await useCase.execute("m1");
    expect(entries.lastCreate?.minutes).toBe(2);
    expect(entries.lastCreate?.origin).toBe("timer");
    expect(entries.lastCreate?.ratePerHourSnapshot).toBe(45);
    expect(entries.lastCreate?.billable).toBe(true);
    expect(sessions.cleared).toBe(true);
  });

  it("logs at least 1 minute on an immediate stop", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(2_000);
    const entries = new FakeEntries();
    const useCase = new StopTimerUseCase(sessions, entries);
    await useCase.execute("m1");
    expect(entries.lastCreate?.minutes).toBe(1);
  });

  it("throws NotFound when no timer is running", async () => {
    const useCase = new StopTimerUseCase(new FakeSessions(), new FakeEntries());
    await expect(useCase.execute("m1")).rejects.toThrow(NotFoundException);
  });

  it("rounds up 9.5 minutes to 10 (not 9)", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(570_000);
    const entries = new FakeEntries();
    const useCase = new StopTimerUseCase(sessions, entries);
    await useCase.execute("m1");
    expect(entries.lastCreate?.minutes).toBe(10);
  });

  it("clamps negative elapsed time to 1 minute (clock skew)", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(-60_000);
    const entries = new FakeEntries();
    const useCase = new StopTimerUseCase(sessions, entries);
    await useCase.execute("m1");
    expect(entries.lastCreate?.minutes).toBe(1);
  });

  it("double-stop race: second call throws NotFound and entry is created only once", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(120_000);
    const entries = new FakeEntries();
    const useCase = new StopTimerUseCase(sessions, entries);
    await useCase.execute("m1");
    await expect(useCase.execute("m1")).rejects.toThrow(NotFoundException);
    expect(entries.createCalls).toBe(1);
  });
});
