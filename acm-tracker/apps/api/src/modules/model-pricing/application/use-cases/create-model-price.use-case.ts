import { Inject, Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { MODEL_PRICE_REPOSITORY, ModelPriceRepositoryPort } from "../../domain/ports/model-price.repository.port";
import { CreateModelPriceDto } from "../../interfaces/http/dto/create-model-price.dto";

@Injectable()
export class CreateModelPriceUseCase {
  constructor(@Inject(MODEL_PRICE_REPOSITORY) private readonly repo: ModelPriceRepositoryPort) {}

  execute(dto: CreateModelPriceDto): Promise<ModelPrice> {
    return this.repo.create(dto);
  }
}
