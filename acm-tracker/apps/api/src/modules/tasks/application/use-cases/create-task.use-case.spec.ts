import { CreateTaskUseCase } from "./create-task.use-case";
import type { Task } from "@acm/shared";
import { CreateTaskData, TaskRepositoryPort, UpdateTaskData } from "../../domain/ports/task.repository.port";

class FakeTaskRepo implements TaskRepositoryPort {
  public lastCreate?: CreateTaskData;
  async create(data: CreateTaskData): Promise<Task> {
    this.lastCreate = data;
    return { id: "t1", status: "todo", summary: null, createdAt: "now", ...data };
  }
  async findAll(): Promise<Task[]> {
    return [];
  }
  async update(_id: string, _data: UpdateTaskData): Promise<Task> {
    throw new Error("not used");
  }
}

describe("CreateTaskUseCase", () => {
  it("defaults phase and estimate to null when omitted", async () => {
    const repo = new FakeTaskRepo();
    const useCase = new CreateTaskUseCase(repo);
    await useCase.execute({ projectId: "p1", code: "T-1", title: "Do" });
    expect(repo.lastCreate).toEqual({
      projectId: "p1", code: "T-1", title: "Do", phase: null, estimateMinutes: null,
    });
  });
});
