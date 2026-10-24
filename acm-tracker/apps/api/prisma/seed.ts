import { createPrismaClient } from "../src/prisma/prisma.service";

const prisma = createPrismaClient();

async function main() {
  await prisma.workspaceSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, authProvider: "none" },
  });

  const owner = await prisma.member.upsert({
    where: { email: process.env.OWNER_EMAIL ?? "owner@acm.local" },
    update: {},
    create: {
      name: process.env.OWNER_NAME ?? "Harry G.",
      email: process.env.OWNER_EMAIL ?? "owner@acm.local",
      role: "owner",
      ratePerHour: Number(process.env.OWNER_RATE_PER_HOUR ?? 45),
    },
  });

  if ((await prisma.project.count()) > 0) {
    console.log(`Seeded owner ${owner.email}; sample project already present`);
    return;
  }

  const project = await prisma.project.create({
    data: { name: "Helios", client: "Helios", contractAmount: 30000, status: "active" },
  });

  await prisma.task.create({
    data: { projectId: project.id, code: "T-142", title: "Cognito preToken lambda", phase: "Ejecución", estimateMinutes: 480 },
  });

  console.log(`Seeded owner ${owner.email} + sample project ${project.name}`);
}

main().finally(() => prisma.$disconnect());
