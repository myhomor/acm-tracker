import { Module } from "@nestjs/common";
import { MODEL_PRICE_REPOSITORY } from "./domain/ports/model-price.repository.port";
import { CreateModelPriceUseCase } from "./application/use-cases/create-model-price.use-case";
import { ListModelPricesUseCase } from "./application/use-cases/list-model-prices.use-case";
import { UpdateModelPriceUseCase } from "./application/use-cases/update-model-price.use-case";
import { DeleteModelPriceUseCase } from "./application/use-cases/delete-model-price.use-case";
import { PrismaModelPriceRepository } from "./infrastructure/persistence/prisma-model-price.repository";
import { ModelPricesController } from "./interfaces/http/model-prices.controller";

@Module({
  controllers: [ModelPricesController],
  providers: [
    CreateModelPriceUseCase,
    ListModelPricesUseCase,
    UpdateModelPriceUseCase,
    DeleteModelPriceUseCase,
    { provide: MODEL_PRICE_REPOSITORY, useClass: PrismaModelPriceRepository },
  ],
})
export class ModelPricingModule {}
