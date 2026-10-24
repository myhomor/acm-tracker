import { Inject, Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { MODEL_PRICE_REPOSITORY, ModelPriceRepositoryPort } from "../../domain/ports/model-price.repository.port";

@Injectable()
export class ListModelPricesUseCase {
  constructor(@Inject(MODEL_PRICE_REPOSITORY) private readonly repo: ModelPriceRepositoryPort) {}

  execute(): Promise<ModelPrice[]> {
    return this.repo.findAll();
  }
}
