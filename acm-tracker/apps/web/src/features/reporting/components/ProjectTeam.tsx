import { useTranslation } from "react-i18next";
import { Panel } from "../../../components/Panel";
import { DataTable } from "../../../components/DataTable";
import { Avatar } from "../../../components/Avatar";
import { useProjectTeam } from "../api/use-reporting";
import { colors } from "../../../theme/tokens";

function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function ProjectTeam({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data: team = [] } = useProjectTeam(projectId);

  return (
    <Panel title={t("projects.teamPanelTitle")}>
      <DataTable
        columns={[
          { key: "person", label: t("settings.colPerson") },
          { key: "hours", label: t("projects.colHours"), width: 80, align: "right" },
          { key: "human", label: t("projects.colHumanCost"), width: 130, align: "right" },
          { key: "ai", label: t("projects.colAiCost"), width: 100, align: "right" },
          { key: "total", label: t("projects.colTotal"), width: 100, align: "right" },
        ]}
        rows={team.map((p, i) => ({
          id: p.memberId,
          cells: {
            person: (
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar initials={initialsOf(p.name)} index={i} size={30} />
                <span style={{ fontWeight: 600 }}>{p.name}</span>
              </span>
            ),
            hours: <span className="mono" style={{ color: colors.muted }}>{Math.floor(p.minutes / 60)}h</span>,
            human: <span className="mono">${p.human}</span>,
            ai: <span className="mono" style={{ color: colors.blue }}>${p.ai}</span>,
            total: <span className="mono" style={{ fontWeight: 700, color: colors.green }}>${p.total}</span>,
          },
        }))}
        emptyLabel={t("projects.teamEmpty")}
      />
    </Panel>
  );
}
