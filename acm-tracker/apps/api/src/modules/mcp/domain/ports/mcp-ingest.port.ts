import type { ModelPrice } from "@acm/shared";

export const MCP_INGEST = Symbol("MCP_INGEST");

export interface AiRunInput {
  model: string;
  agent: string | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface RecordWorkInput {
  taskId: string;
  memberId: string;
  minutes: number;
  ratePerHourSnapshot: number;
  note: string | null;
  aiRuns: AiRunInput[];
}

export interface McpReportView {
  id: string;
  time: string;
  agent: string | null;
  person: string;
  task: string;
  minutes: number;
  cost: number;
  aiSummary: string;
}

export interface McpIngestPort {
  getModelPrices(): Promise<ModelPrice[]>;
  getMemberRateByEmail(email: string): Promise<{ id: string; ratePerHour: number } | null>;
  getOwnerEmail(): Promise<string | null>;
  recordWork(input: RecordWorkInput): Promise<void>;
  recentReports(limit: number): Promise<McpReportView[]>;
}
