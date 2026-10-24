const BASE_URL = ((process.env.ACM_API_URL && process.env.ACM_API_URL.trim()) || "http://localhost:5188").replace(/\/$/, "");

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${method} /api${path} -> ${res.status} ${detail}`.trim());
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Project {
  id: string;
  name: string;
  client: string | null;
  contractAmount: number | null;
  status: string;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  phase: string | null;
  status: string;
}

export interface AiRunInput {
  model: string;
  agent?: string;
  tokensIn: number;
  tokensOut: number;
}

export interface ReportWorkInput {
  taskId: string;
  memberEmail: string;
  minutes: number;
  output?: string;
  aiRuns?: AiRunInput[];
}

export interface ReportWorkResult {
  recorded: true;
  aiCost: number;
}

export interface CreateProjectInput {
  name: string;
  client?: string;
  contractAmount?: number;
}

export interface CreateTaskInput {
  projectId: string;
  code: string;
  title: string;
  phase?: string;
  estimateMinutes?: number;
}

export interface ModelPrice {
  id: string;
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
}

export interface SetModelPriceInput {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
}

export interface McpReport {
  id: string;
  time: string;
  agent: string | null;
  person: string;
  task: string;
  minutes: number;
  cost: number;
  aiSummary: string;
}

export const apiClient = {
  baseUrl: BASE_URL,
  listProjects: () => request<Project[]>("GET", "/projects"),
  createProject: (input: CreateProjectInput) => request<Project>("POST", "/projects", input),
  listTasks: (projectId: string) => request<Task[]>("GET", `/tasks?projectId=${encodeURIComponent(projectId)}`),
  createTask: (input: CreateTaskInput) => request<Task>("POST", "/tasks", input),
  reportWork: (input: ReportWorkInput) => request<ReportWorkResult>("POST", "/mcp/report-work", input),
  recentReports: () => request<McpReport[]>("GET", "/mcp/reports"),
  projectCost: (projectId: string) => request<unknown>("GET", `/projects/${encodeURIComponent(projectId)}/cost`),
  todaySummary: () => request<unknown>("GET", "/reports/today"),
  listModelPrices: () => request<ModelPrice[]>("GET", "/model-prices"),
  createModelPrice: (input: SetModelPriceInput) => request<ModelPrice>("POST", "/model-prices", input),
  updateModelPrice: (id: string, input: Partial<SetModelPriceInput>) =>
    request<ModelPrice>("PATCH", `/model-prices/${encodeURIComponent(id)}`, input),
};
