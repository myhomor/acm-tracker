import { Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CreateModelPriceData,
  ModelPriceRepositoryPort,
  UpdateModelPriceData,
} from "../../domain/ports/model-price.repository.port";
import { toDomainModelPrice } from "./model-price.mapper";

@Injectable()
export class PrismaModelPriceRepository implements ModelPriceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateModelPriceData): Promise<ModelPrice> {
    const row = await this.prisma.modelPrice.create({ data });
    return toDomainModelPrice(row);
  }

  async findAll(): Promise<ModelPrice[]> {
    const rows = await this.prisma.modelPrice.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomainModelPrice);
  }

  async update(id: string, data: UpdateModelPriceData): Promise<ModelPrice> {
    const row = await this.prisma.modelPrice.update({ where: { id }, data });
    return toDomainModelPrice(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.modelPrice.delete({ where: { id } });
  }
}
