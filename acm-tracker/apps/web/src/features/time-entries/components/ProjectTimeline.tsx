import { useTranslation } from "react-i18next";
import { Panel } from "../../../components/Panel";
import { DataTable } from "../../../components/DataTable";
import { useProjectEntries } from "../api/use-project-entries";
import { colors } from "../../../theme/tokens";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
}

export function ProjectTimeline({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data: entries = [] } = useProjectEntries(projectId);

  return (
    <Panel title={t("projects.timelinePanelTitle")}>
      <DataTable
        columns={[
          { key: "when", label: t("projects.colDateTime"), width: 140 },
          { key: "task", label: t("projects.colTask") },
          { key: "person", label: t("settings.colPerson"), width: 160 },
          { key: "minutes", label: t("projects.colTime"), width: 90, align: "right" },
          { key: "cost", label: t("projects.detail.colCost"), width: 90, align: "right" },
        ]}
        rows={entries.map((e) => ({
          id: e.id,
          cells: {
            when: <span className="mono" style={{ fontSize: 11, color: colors.dim }}>{formatWhen(e.startedAt)}</span>,
            task: (
              <div>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="mono" style={{ color: colors.coral }}>{e.taskCode}</span>
                  <span style={{ fontWeight: 600 }}>{e.taskTitle}</span>
                </span>
                {e.note && <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{e.note}</div>}
              </div>
            ),
            person: <span style={{ color: colors.muted, fontSize: 13 }}>{e.memberName}</span>,
            minutes: <span className="mono">{formatDuration(e.minutes)}</span>,
            cost: <span className="mono" style={{ fontWeight: 700, color: colors.green }}>${e.cost}</span>,
          },
        }))}
        emptyLabel={t("projects.timelineEmpty")}
      />
    </Panel>
  );
}
