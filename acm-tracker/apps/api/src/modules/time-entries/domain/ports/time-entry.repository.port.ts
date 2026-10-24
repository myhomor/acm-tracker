import type { TimeEntry } from "@acm/shared";

export const TIME_ENTRY_REPOSITORY = Symbol("TIME_ENTRY_REPOSITORY");

export interface CreateTimeEntryData {
  taskId: string;
  memberId: string;
  origin?: "manual" | "timer";
  minutes: number;
  billable: boolean;
  ratePerHourSnapshot: number;
  note: string | null;
  startedAt: Date;
}

export interface TodayEntryView {
  id: string;
  time: string;
  origin: string;
  taskCode: string;
  taskTitle: string;
  memberName: string;
  note: string | null;
  minutes: number;
  cost: number;
  aiCost: number;
}

export interface ProjectEntryView {
  id: string;
  startedAt: string;
  origin: string;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  memberId: string;
  memberName: string;
  note: string | null;
  minutes: number;
  cost: number;
}

export interface TimeEntryRepositoryPort {
  create(data: CreateTimeEntryData): Promise<TimeEntry>;
  findByTask(taskId: string): Promise<TimeEntry[]>;
  findByProject(projectId: string): Promise<ProjectEntryView[]>;
  findToday(from: Date, to: Date): Promise<TodayEntryView[]>;
}
