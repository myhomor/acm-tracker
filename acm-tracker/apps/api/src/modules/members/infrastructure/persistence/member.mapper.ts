import type { Member as PrismaMember } from "@prisma/client";
import type { Member } from "@acm/shared";

export function toDomainMember(row: PrismaMember): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    ratePerHour: row.ratePerHour,
    authProviderUserId: row.authProviderUserId,
    createdAt: row.createdAt.toISOString(),
  };
}
