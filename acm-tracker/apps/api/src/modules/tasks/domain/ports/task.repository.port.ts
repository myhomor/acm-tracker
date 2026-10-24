import type { Task } from "@acm/shared";

export const TASK_REPOSITORY = Symbol("TASK_REPOSITORY");

export interface CreateTaskData {
  projectId: string;
  code: string;
  title: string;
  phase: string | null;
  estimateMinutes: number | null;
}

export interface UpdateTaskData {
  code?: string;
  title?: string;
  phase?: string | null;
  summary?: string | null;
  estimateMinutes?: number | null;
  status?: string;
}

export interface TaskRepositoryPort {
  create(data: CreateTaskData): Promise<Task>;
  findAll(projectId?: string): Promise<Task[]>;
  update(id: string, data: UpdateTaskData): Promise<Task>;
}
