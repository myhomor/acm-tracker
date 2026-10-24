import { Test } from "@nestjs/testing";
import { NoAuthProvider } from "./no-auth.provider";
import { PrismaService } from "../prisma/prisma.service";

describe("NoAuthProvider", () => {
  const prisma = { member: { findFirst: jest.fn() } } as any;
  let provider: NoAuthProvider;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [NoAuthProvider, { provide: PrismaService, useValue: prisma }],
    }).compile();
    provider = mod.get(NoAuthProvider);
  });

  it("does not enforce identity", () => {
    expect(provider.enforces).toBe(false);
  });

  it("returns the first member as the local owner", async () => {
    prisma.member.findFirst.mockResolvedValue({ id: "m1", email: "o@acm.local", name: "Owner" });
    const u = await provider.getCurrentUser({});
    expect(u).toEqual({ memberId: "m1", email: "o@acm.local", name: "Owner" });
  });

  it("throws if no owner has been seeded", async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(provider.getCurrentUser({})).rejects.toThrow(/owner/i);
  });
});
