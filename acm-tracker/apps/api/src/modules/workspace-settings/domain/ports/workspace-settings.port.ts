export const WORKSPACE_SETTINGS = Symbol("WORKSPACE_SETTINGS");

export interface WorkspaceSettingsView {
  dailyCostTarget: number;
}

export interface WorkspaceSettingsPort {
  get(): Promise<WorkspaceSettingsView>;
  update(patch: { dailyCostTarget?: number }): Promise<WorkspaceSettingsView>;
}
