export type EntryOrigin = "manual" | "timer" | "mcp";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  ratePerHour: number; // USD/hour
  authProviderUserId: string | null; // null until a real auth provider links it
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  client: string | null;
  contractAmount: number | null; // USD, nullable for internal projects
  estimateHours: number | null; // manual estimate of total project hours
  ratePerHour: number | null; // USD/hour sale rate charged to the client
  status: "active" | "paused" | "done";
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  code: string; // e.g. "T-142"
  title: string;
  phase: string | null; // optional lifecycle label
  summary: string | null;
  status: "todo" | "in_progress" | "review" | "waiting" | "hold" | "done";
  estimateMinutes: number | null;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  memberId: string;
  origin: EntryOrigin;
  minutes: number;
  billable: boolean;
  ratePerHourSnapshot: number; // rate captured at entry time
  note: string | null;
  startedAt: string;
  createdAt: string;
}

export interface ModelPrice {
  id: string;
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  createdAt: string;
}

export interface AiUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface CostBreakdown {
  human: number;
  ai: number;
  total: number;
}

export interface PersonCost {
  memberId: string;
  name: string;
  kind: "agent" | "wait" | "human";
  minutes: number;
  human: number;
  ai: number;
  total: number;
}

export interface WeeklyCost {
  week: string;
  human: number;
  ai: number;
}

export interface DailyTask {
  taskId: string;
  code: string;
  title: string;
  project: string;
  minutes: number;
}

export interface DailyReport {
  date: string; // local YYYY-MM-DD
  agentMinutes: number;
  waitMinutes: number;
  humanMinutes: number;
  totalMinutes: number;
  timeCost: number;
  aiCost: number;
  tasks: DailyTask[];
}

export interface NotificationRule {
  id: string;
  event: string;
  condition: string;
  channel: string;
  enabled: boolean;
  createdAt: string;
}

export type DocumentKind = "page" | "file" | "link";

export interface DocumentItem {
  id: string;
  projectId: string | null;
  kind: DocumentKind;
  title: string;
  phase: string | null;
  url: string | null;
  createdBy: string | null;
  createdAt: string;
}
