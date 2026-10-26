import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { TileRow } from "../components/TileRow";
import { StackedBars } from "../components/StackedBars";
import { DataTable } from "../components/DataTable";
import { useCostByPerson, useWeeklyCost } from "../features/reporting/api/use-reporting";
import { useProjects } from "../features/projects/api/use-projects";
import { DailyReportPanel } from "../features/reporting/components/DailyReportPanel";
import { formatMinutes } from "../lib/format-minutes";
import { colors } from "../theme/tokens";

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function Reports() {
  const { t } = useTranslation();
  const [projectId, setProjectId] = useState("");
  const { data: projects = [] } = useProjects();
  const { data: allPeople = [] } = useCostByPerson(projectId || undefined);
  const { data: weekly = [] } = useWeeklyCost(projectId || undefined);
  const people = allPeople.filter((p) => p.minutes > 0);
  const workers = people.filter((p) => p.kind !== "wait");
  const waitMinutes = people.filter((p) => p.kind === "wait").reduce((s, p) => s + p.minutes, 0);
  const totalCost = round2(people.reduce((s, p) => s + p.total, 0));
  const totalAi = round2(people.reduce((s, p) => s + p.ai, 0));
  const totalHuman = round2(people.reduce((s, p) => s + p.human, 0));
  const totalMinutes = workers.reduce((s, p) => s + p.minutes, 0);
  const totalHours = Math.round(totalMinutes / 60);
  const avgRate = totalMinutes > 0 ? ((totalCost * 60) / totalMinutes).toFixed(1) : "0";

  const exportCsv = () => {
    const header = "persona,minutos,horas,ia_usd,costo_usd";
    const lines = people.map((p) => `${p.name},${p.minutes},${(p.minutes / 60).toFixed(2)},${p.ai},${p.total}`);
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acm-tracker-costo-por-persona.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Chrome breadcrumb={t("reports.breadcrumb")}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t("reports.title")}</h1>
      <div className="mono" style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
        {t("reports.subtitle")}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span className="mono" style={{ fontSize: 11, color: colors.muted, letterSpacing: 1 }}>{t("reports.projectFilterLabel")}</span>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label={t("reports.projectFilterLabel")}
          style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "8px 10px", minWidth: 260 }}
        >
          <option value="">{t("reports.allProjects")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <div style={{ marginBottom: 16 }}>
        <TileRow
          columns={5}
          tiles={[
            { label: t("reports.tileHorasLabel"), value: formatMinutes(totalMinutes) },
            { label: t("reports.tileCostoTotalLabel"), value: `$${totalCost}`, sub: t("reports.tileCostSplit", { human: totalHuman, ai: totalAi }) },
            { label: t("reports.colIa"), value: `$${totalAi}`, sub: t("reports.tileViaMcp"), accent: colors.blue },
            { label: t("reports.tileTasaLabel"), value: `$${avgRate}`, accent: colors.green },
            { label: t("reports.tileWaitLabel"), value: formatMinutes(waitMinutes), sub: t("reports.tileWaitSub"), accent: colors.amber },
          ]}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", gap: 16 }}>
        <Panel title={t("reports.weeklyPanelTitle")}>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 11, color: colors.coral }}>{t("reports.legendHumano")}</span>
            <span className="mono" style={{ fontSize: 11, color: colors.blue }}>{t("reports.legendIa")}</span>
          </div>
          <StackedBars data={weekly.map((w) => ({ label: w.week, human: w.human, ai: w.ai }))} />
        </Panel>
        <Panel title={t("reports.peoplePanelTitle")}>
          <DataTable
            columns={[
              { key: "name", label: t("reports.colPersona") },
              { key: "hours", label: t("reports.colHoras"), width: 70, align: "right" },
              { key: "ai", label: t("reports.colIa"), width: 60, align: "right" },
              { key: "cost", label: t("reports.colCosto"), width: 90, align: "right" },
            ]}
            rows={people.map((p) => ({
              id: p.memberId,
              cells: {
                name: <span style={{ fontWeight: 600 }}>{p.name}</span>,
                hours: <span className="mono" style={{ color: colors.muted }}>{formatMinutes(p.minutes)}</span>,
                ai: <span className="mono" style={{ color: colors.blue }}>${p.ai}</span>,
                cost: <span className="mono" style={{ fontWeight: 700 }}>${p.total}</span>,
              },
            }))}
            emptyLabel={t("reports.emptyPeople")}
          />
        </Panel>
      </div>
      <div style={{ marginTop: 16 }}>
        <DailyReportPanel projectId={projectId || undefined} />
      </div>
      <div style={{ marginTop: 16 }}>
        <Panel title={t("reports.exportPanelTitle")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18 }}>
              <div style={{ fontWeight: 600 }}>{t("reports.csvCardTitle")}</div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{t("reports.csvCardDesc")}</div>
              <button onClick={exportCsv} aria-label={t("reports.csvAriaLabel")} style={{ marginTop: 14, background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700 }}>
                {t("reports.csvDownloadButton")}
              </button>
            </div>
            <div style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 18 }}>
              <div style={{ fontWeight: 600 }}>{t("reports.summaryCardTitle")}</div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{t("reports.summaryMeta", { count: workers.length, hours: totalHours, cost: totalCost })}</div>
              <div className="mono" style={{ fontSize: 12, color: colors.dim, marginTop: 14 }}>{t("reports.comingSoon")}</div>
            </div>
          </div>
        </Panel>
      </div>
    </Chrome>
  );
}
