import type { DailyReport } from "@acm/shared";

export type WorkKind = "agent" | "wait" | "human";

export interface DailyEntryRow {
  day: string;
  kind: WorkKind;
  minutes: number;
  timeCost: number;
  aiCost: number;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  projectName: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const MINUTES_BY_KIND = { agent: "agentMinutes", wait: "waitMinutes", human: "humanMinutes" } as const;

function emptyDay(date: string): DailyReport {
  return { date, agentMinutes: 0, waitMinutes: 0, humanMinutes: 0, totalMinutes: 0, timeCost: 0, aiCost: 0, tasks: [] };
}

function addTask(day: DailyReport, row: DailyEntryRow): void {
  const task = day.tasks.find((t) => t.taskId === row.taskId);
  if (task) task.minutes += row.minutes;
  else day.tasks.push({ taskId: row.taskId, code: row.taskCode, title: row.taskTitle, project: row.projectName, minutes: row.minutes });
}

function addRow(day: DailyReport, row: DailyEntryRow): void {
  day[MINUTES_BY_KIND[row.kind]] += row.minutes;
  day.totalMinutes += row.minutes;
  day.timeCost += row.timeCost;
  day.aiCost += row.aiCost;
  addTask(day, row);
}

export function groupByDay(rows: DailyEntryRow[]): DailyReport[] {
  const days = new Map<string, DailyReport>();
  for (const row of rows) {
    const day = days.get(row.day) ?? emptyDay(row.day);
    addRow(day, row);
    days.set(row.day, day);
  }
  return [...days.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => ({ ...d, timeCost: round2(d.timeCost), aiCost: round2(d.aiCost), tasks: d.tasks.sort((a, b) => b.minutes - a.minutes) }));
}
