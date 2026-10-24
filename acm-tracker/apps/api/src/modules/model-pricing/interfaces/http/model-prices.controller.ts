import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CreateModelPriceUseCase } from "../../application/use-cases/create-model-price.use-case";
import { ListModelPricesUseCase } from "../../application/use-cases/list-model-prices.use-case";
import { UpdateModelPriceUseCase } from "../../application/use-cases/update-model-price.use-case";
import { DeleteModelPriceUseCase } from "../../application/use-cases/delete-model-price.use-case";
import { CreateModelPriceDto } from "./dto/create-model-price.dto";
import { UpdateModelPriceDto } from "./dto/update-model-price.dto";

@UseGuards(AuthGuard)
@Controller("model-prices")
export class ModelPricesController {
  constructor(
    private readonly createPrice: CreateModelPriceUseCase,
    private readonly listPrices: ListModelPricesUseCase,
    private readonly updatePrice: UpdateModelPriceUseCase,
    private readonly deletePrice: DeleteModelPriceUseCase,
  ) {}

  @Post() create(@Body() dto: CreateModelPriceDto) {
    return this.createPrice.execute(dto);
  }

  @Get() findAll() {
    return this.listPrices.execute();
  }

  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateModelPriceDto) {
    return this.updatePrice.execute(id, dto);
  }

  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.deletePrice.execute(id);
  }
}
