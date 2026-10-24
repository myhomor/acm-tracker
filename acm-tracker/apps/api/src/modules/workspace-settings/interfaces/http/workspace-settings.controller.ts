import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { GetWorkspaceSettingsUseCase } from "../../application/use-cases/get-workspace-settings.use-case";
import { UpdateWorkspaceSettingsUseCase } from "../../application/use-cases/update-workspace-settings.use-case";
import { UpdateWorkspaceSettingsDto } from "./dto/update-workspace-settings.dto";

@UseGuards(AuthGuard)
@Controller("workspace-settings")
export class WorkspaceSettingsController {
  constructor(
    private readonly getSettings: GetWorkspaceSettingsUseCase,
    private readonly updateSettings: UpdateWorkspaceSettingsUseCase,
  ) {}

  @Get() get() {
    return this.getSettings.execute();
  }

  @Patch() update(@Body() dto: UpdateWorkspaceSettingsDto) {
    return this.updateSettings.execute(dto);
  }
}
