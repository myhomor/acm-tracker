import { CreateModelPriceUseCase } from "./create-model-price.use-case";
import type { ModelPrice } from "@acm/shared";
import {
  CreateModelPriceData,
  ModelPriceRepositoryPort,
  UpdateModelPriceData,
} from "../../domain/ports/model-price.repository.port";

class FakeRepo implements ModelPriceRepositoryPort {
  public lastCreate?: CreateModelPriceData;
  async create(data: CreateModelPriceData): Promise<ModelPrice> {
    this.lastCreate = data;
    return { id: "mp1", createdAt: "now", ...data };
  }
  async findAll(): Promise<ModelPrice[]> {
    return [];
  }
  async update(_id: string, _data: UpdateModelPriceData): Promise<ModelPrice> {
    throw new Error("unused");
  }
  async delete(_id: string): Promise<void> {}
}

describe("CreateModelPriceUseCase", () => {
  it("persists the provided price", async () => {
    const repo = new FakeRepo();
    const useCase = new CreateModelPriceUseCase(repo);
    await useCase.execute({ provider: "anthropic", model: "opus", inputPer1M: 15, outputPer1M: 75 });
    expect(repo.lastCreate).toEqual({ provider: "anthropic", model: "opus", inputPer1M: 15, outputPer1M: 75 });
  });
});
