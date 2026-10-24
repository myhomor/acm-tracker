import { Inject, Injectable } from "@nestjs/common";
import { MODEL_PRICE_REPOSITORY, ModelPriceRepositoryPort } from "../../domain/ports/model-price.repository.port";

@Injectable()
export class DeleteModelPriceUseCase {
  constructor(@Inject(MODEL_PRICE_REPOSITORY) private readonly repo: ModelPriceRepositoryPort) {}

  execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
