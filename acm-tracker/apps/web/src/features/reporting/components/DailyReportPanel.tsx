import { useTranslation } from "react-i18next";
import type { DailyTask } from "@acm/shared";
import { Panel } from "../../../components/Panel";
import { DataTable } from "../../../components/DataTable";
import { useDailyReport } from "../api/use-reporting";
import { formatMinutes as hm } from "../../../lib/format-minutes";
import { colors } from "../../../theme/tokens";

const TASKS_SHOWN = 4;

function dayLabel(date: string, lang: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(lang, { weekday: "short", day: "2-digit", month: "2-digit" });
}

function TaskList({ tasks, showProject }: { tasks: DailyTask[]; showProject: boolean }) {
  const shown = tasks.slice(0, TASKS_SHOWN);
  const rest = tasks.length - shown.length;
  return (
    <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
      {shown.map((t) => (
        <span key={t.taskId}>
          <span className="mono" style={{ color: colors.dim }}>{hm(t.minutes)}</span> {t.title}
          {showProject && <span style={{ color: colors.dim }}> · {t.project}</span>}
        </span>
      ))}
      {rest > 0 && <span style={{ color: colors.dim }}>+{rest}</span>}
    </div>
  );
}

export function DailyReportPanel({ projectId }: { projectId?: string }) {
  const { t, i18n } = useTranslation();
  const { data: days = [] } = useDailyReport(projectId);
  const mono = (value: string, color: string = colors.text) => <span className="mono" style={{ color }}>{value}</span>;

  return (
    <Panel title={t("reports.dailyPanelTitle")}>
      <DataTable
        columns={[
          { key: "day", label: t("reports.colDay") },
          { key: "human", label: t("reports.colHuman"), width: 90, align: "right" },
          { key: "agent", label: t("reports.colAgent"), width: 90, align: "right" },
          { key: "wait", label: t("reports.colWait"), width: 90, align: "right" },
          { key: "total", label: t("reports.colTotal"), width: 90, align: "right" },
          { key: "ai", label: t("reports.colIa"), width: 80, align: "right" },
          { key: "cost", label: t("reports.colTimeCost"), width: 90, align: "right" },
        ]}
        rows={days.map((d) => ({
          id: d.date,
          cells: {
            day: (
              <div>
                <span style={{ fontWeight: 600 }}>{dayLabel(d.date, i18n.language)}</span>
                <TaskList tasks={d.tasks} showProject={!projectId} />
              </div>
            ),
            human: mono(hm(d.humanMinutes), colors.green),
            agent: mono(hm(d.agentMinutes), colors.blue),
            wait: mono(hm(d.waitMinutes), colors.amber),
            total: <span className="mono" style={{ fontWeight: 700 }}>{hm(d.totalMinutes)}</span>,
            ai: mono(`$${d.aiCost}`, colors.blue),
            cost: mono(`$${d.timeCost}`),
          },
        }))}
        emptyLabel={t("reports.dailyEmpty")}
      />
    </Panel>
  );
}
