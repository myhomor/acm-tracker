import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { WorkspaceSettingsPort, WorkspaceSettingsView } from "../../domain/ports/workspace-settings.port";

@Injectable()
export class PrismaWorkspaceSettingsRepository implements WorkspaceSettingsPort {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<WorkspaceSettingsView> {
    const row = await this.prisma.workspaceSettings.findUnique({ where: { id: 1 } });
    return { dailyCostTarget: row?.dailyCostTarget ?? 2400 };
  }

  async update(patch: { dailyCostTarget?: number }): Promise<WorkspaceSettingsView> {
    const data = patch.dailyCostTarget !== undefined ? { dailyCostTarget: patch.dailyCostTarget } : {};
    const row = await this.prisma.workspaceSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    return { dailyCostTarget: row.dailyCostTarget };
  }
}
