import type { ModelPrice as PrismaModelPrice } from "@prisma/client";
import type { ModelPrice } from "@acm/shared";

export function toDomainModelPrice(row: PrismaModelPrice): ModelPrice {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputPer1M: row.inputPer1M,
    outputPer1M: row.outputPer1M,
    createdAt: row.createdAt.toISOString(),
  };
}
