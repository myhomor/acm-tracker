import { PartialType } from "@nestjs/mapped-types";
import { CreateModelPriceDto } from "./create-model-price.dto";

export class UpdateModelPriceDto extends PartialType(CreateModelPriceDto) {}
