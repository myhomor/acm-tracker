import { NotFoundException } from "@nestjs/common";
import { GetProjectUseCase } from "./get-project.use-case";
import type { Project } from "@acm/shared";
import {
  CreateProjectData,
  ProjectRepositoryPort,
  ProjectWithTasks,
  UpdateProjectData,
} from "../../domain/ports/project.repository.port";

class FakeProjectRepo implements ProjectRepositoryPort {
  constructor(private readonly stored: ProjectWithTasks | null) {}
  async create(_data: CreateProjectData): Promise<Project> {
    throw new Error("not used");
  }
  async findAll(): Promise<Project[]> {
    return [];
  }
  async findById(_id: string): Promise<ProjectWithTasks | null> {
    return this.stored;
  }
  async update(_id: string, _data: UpdateProjectData): Promise<Project> {
    throw new Error("not used");
  }
}

describe("GetProjectUseCase", () => {
  it("returns the project with its tasks", async () => {
    const project: ProjectWithTasks = {
      id: "p1", name: "Helios", client: "Helios", contractAmount: 30000,
      estimateHours: null, ratePerHour: null,
      status: "active", createdAt: "now", tasks: [],
    };
    const useCase = new GetProjectUseCase(new FakeProjectRepo(project));
    expect(await useCase.execute("p1")).toBe(project);
  });

  it("throws NotFound when the project is missing", async () => {
    const useCase = new GetProjectUseCase(new FakeProjectRepo(null));
    await expect(useCase.execute("nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});
