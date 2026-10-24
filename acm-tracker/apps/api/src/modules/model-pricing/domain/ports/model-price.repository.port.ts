import type { ModelPrice } from "@acm/shared";

export const MODEL_PRICE_REPOSITORY = Symbol("MODEL_PRICE_REPOSITORY");

export interface CreateModelPriceData {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
}

export interface UpdateModelPriceData {
  provider?: string;
  model?: string;
  inputPer1M?: number;
  outputPer1M?: number;
}

export interface ModelPriceRepositoryPort {
  create(data: CreateModelPriceData): Promise<ModelPrice>;
  findAll(): Promise<ModelPrice[]>;
  update(id: string, data: UpdateModelPriceData): Promise<ModelPrice>;
  delete(id: string): Promise<void>;
}
