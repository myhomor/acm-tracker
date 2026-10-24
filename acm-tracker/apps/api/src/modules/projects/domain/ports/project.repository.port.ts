import type { Project, Task } from "@acm/shared";

export const PROJECT_REPOSITORY = Symbol("PROJECT_REPOSITORY");

export interface CreateProjectData {
  name: string;
  client: string | null;
  contractAmount: number | null;
  estimateHours: number | null;
  ratePerHour: number | null;
}

export interface UpdateProjectData {
  name?: string;
  client?: string | null;
  contractAmount?: number | null;
  estimateHours?: number | null;
  ratePerHour?: number | null;
  status?: string;
}

export type ProjectWithTasks = Project & { tasks: Task[] };

export interface ProjectRepositoryPort {
  create(data: CreateProjectData): Promise<Project>;
  findAll(): Promise<Project[]>;
  findById(id: string): Promise<ProjectWithTasks | null>;
  update(id: string, data: UpdateProjectData): Promise<Project>;
}
