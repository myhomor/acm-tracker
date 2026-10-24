import { UpdateWorkspaceSettingsUseCase } from "./update-workspace-settings.use-case";
import { WorkspaceSettingsPort, WorkspaceSettingsView } from "../../domain/ports/workspace-settings.port";

class FakeSettings implements WorkspaceSettingsPort {
  public value: WorkspaceSettingsView = { dailyCostTarget: 2400 };
  async get(): Promise<WorkspaceSettingsView> { return this.value; }
  async update(patch: { dailyCostTarget?: number }): Promise<WorkspaceSettingsView> {
    this.value = { dailyCostTarget: patch.dailyCostTarget ?? this.value.dailyCostTarget };
    return this.value;
  }
}

describe("UpdateWorkspaceSettingsUseCase", () => {
  it("updates the daily cost target", async () => {
    const port = new FakeSettings();
    const useCase = new UpdateWorkspaceSettingsUseCase(port);
    const result = await useCase.execute({ dailyCostTarget: 3000 });
    expect(result.dailyCostTarget).toBe(3000);
  });

  it("keeps the current value when patch is empty", async () => {
    const port = new FakeSettings();
    const useCase = new UpdateWorkspaceSettingsUseCase(port);
    const result = await useCase.execute({});
    expect(result.dailyCostTarget).toBe(2400);
  });
});
