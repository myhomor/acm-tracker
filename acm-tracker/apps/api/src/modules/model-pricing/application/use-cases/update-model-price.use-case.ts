import { Inject, Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { MODEL_PRICE_REPOSITORY, ModelPriceRepositoryPort } from "../../domain/ports/model-price.repository.port";
import { UpdateModelPriceDto } from "../../interfaces/http/dto/update-model-price.dto";

@Injectable()
export class UpdateModelPriceUseCase {
  constructor(@Inject(MODEL_PRICE_REPOSITORY) private readonly repo: ModelPriceRepositoryPort) {}

  execute(id: string, dto: UpdateModelPriceDto): Promise<ModelPrice> {
    return this.repo.update(id, dto);
  }
}
