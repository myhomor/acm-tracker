import { Inject, Injectable } from "@nestjs/common";
import { WORKSPACE_SETTINGS, WorkspaceSettingsPort, WorkspaceSettingsView } from "../../domain/ports/workspace-settings.port";

@Injectable()
export class GetWorkspaceSettingsUseCase {
  constructor(@Inject(WORKSPACE_SETTINGS) private readonly settings: WorkspaceSettingsPort) {}
  execute(): Promise<WorkspaceSettingsView> {
    return this.settings.get();
  }
}
