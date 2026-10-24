import { Module } from "@nestjs/common";
import { WORKSPACE_SETTINGS } from "./domain/ports/workspace-settings.port";
import { GetWorkspaceSettingsUseCase } from "./application/use-cases/get-workspace-settings.use-case";
import { UpdateWorkspaceSettingsUseCase } from "./application/use-cases/update-workspace-settings.use-case";
import { PrismaWorkspaceSettingsRepository } from "./infrastructure/persistence/prisma-workspace-settings.repository";
import { WorkspaceSettingsController } from "./interfaces/http/workspace-settings.controller";

@Module({
  controllers: [WorkspaceSettingsController],
  providers: [
    GetWorkspaceSettingsUseCase,
    UpdateWorkspaceSettingsUseCase,
    { provide: WORKSPACE_SETTINGS, useClass: PrismaWorkspaceSettingsRepository },
  ],
})
export class WorkspaceSettingsModule {}
