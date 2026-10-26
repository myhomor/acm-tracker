import { DailyEntryRow, groupByDay } from "./daily-report";

const row = (over: Partial<DailyEntryRow>): DailyEntryRow => ({
  day: "2026-10-24",
  kind: "human",
  minutes: 10,
  timeCost: 0,
  aiCost: 0,
  taskId: "t1",
  taskCode: "S-1",
  taskTitle: "Task one",
  projectName: "p",
  ...over,
});

describe("groupByDay", () => {
  it("splits minutes by kind and sums costs per day", () => {
    const [day] = groupByDay([
      row({ kind: "agent", minutes: 30, aiCost: 1.234 }),
      row({ kind: "wait", minutes: 20 }),
      row({ kind: "human", minutes: 15, timeCost: 7.5 }),
    ]);
    expect(day).toMatchObject({
      date: "2026-10-24",
      agentMinutes: 30,
      waitMinutes: 20,
      humanMinutes: 15,
      totalMinutes: 45,
      timeCost: 7.5,
      aiCost: 1.23,
    });
  });

  it("keeps waiting out of the day total and the task list", () => {
    const [day] = groupByDay([
      row({ kind: "wait", minutes: 354, taskId: "t9", taskCode: "S-9" }),
      row({ kind: "agent", minutes: 22, taskId: "t1" }),
    ]);
    expect(day.totalMinutes).toBe(22);
    expect(day.waitMinutes).toBe(354);
    expect(day.tasks.map((t) => [t.code, t.minutes])).toEqual([["S-1", 22]]);
  });

  it("orders days newest first and tasks by time spent", () => {
    const days = groupByDay([
      row({ day: "2026-10-22", taskId: "t1" }),
      row({ day: "2026-10-24", taskId: "t1", minutes: 5 }),
      row({ day: "2026-10-24", taskId: "t2", taskCode: "S-2", minutes: 40 }),
      row({ day: "2026-10-24", taskId: "t1", minutes: 5 }),
    ]);
    expect(days.map((d) => d.date)).toEqual(["2026-10-24", "2026-10-22"]);
    expect(days[0].tasks.map((t) => [t.code, t.minutes])).toEqual([["S-2", 40], ["S-1", 10]]);
  });

  it("returns an empty list when there are no entries", () => {
    expect(groupByDay([])).toEqual([]);
  });
});
