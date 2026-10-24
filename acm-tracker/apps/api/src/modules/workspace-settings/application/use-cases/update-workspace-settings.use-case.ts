import { Inject, Injectable } from "@nestjs/common";
import { WORKSPACE_SETTINGS, WorkspaceSettingsPort, WorkspaceSettingsView } from "../../domain/ports/workspace-settings.port";

@Injectable()
export class UpdateWorkspaceSettingsUseCase {
  constructor(@Inject(WORKSPACE_SETTINGS) private readonly settings: WorkspaceSettingsPort) {}
  execute(patch: { dailyCostTarget?: number }): Promise<WorkspaceSettingsView> {
    return this.settings.update(patch);
  }
}
