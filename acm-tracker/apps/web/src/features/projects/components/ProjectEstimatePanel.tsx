import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Panel } from "../../../components/Panel";
import { EditableRate } from "../../../components/EditableRate";
import { colors } from "../../../theme/tokens";
import { useUpdateProject } from "../api/use-projects";

interface ProjectEstimatePanelProps {
  projectId: string;
  estimateHours: number | null;
  ratePerHour: number | null;
}

export function ProjectEstimatePanel({ projectId, estimateHours, ratePerHour }: ProjectEstimatePanelProps) {
  const { t } = useTranslation();
  const update = useUpdateProject(projectId);

  return (
    <Panel title={t("projects.estimatePanelTitle")}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={t("projects.estimateHoursLabel")}>
          <EditableRate
            label={t("projects.estimateHoursAriaLabel")}
            format="hours"
            value={estimateHours ?? 0}
            saving={update.isPending}
            onSave={(estimateHours) => update.mutate({ estimateHours })}
          />
        </Field>
        <Field label={t("projects.rateLabel")}>
          <EditableRate
            label={t("projects.rateAriaLabel")}
            value={ratePerHour ?? 0}
            saving={update.isPending}
            onSave={(ratePerHour) => update.mutate({ ratePerHour })}
          />
        </Field>
        {ratePerHour == null && (
          <div style={{ fontSize: 11, color: colors.dim }}>
            {t("projects.defineRateHint")}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span className="mono" style={{ fontSize: 11, letterSpacing: 1, color: colors.muted }}>
        {label.toUpperCase()}
      </span>
      {children}
    </div>
  );
}
