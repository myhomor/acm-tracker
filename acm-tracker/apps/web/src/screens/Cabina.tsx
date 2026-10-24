import { useTranslation } from "react-i18next";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { RingGauge } from "../components/RingGauge";
import { TileRow } from "../components/TileRow";
import { PersonCostRow } from "../components/PersonCostRow";
import { McpStream } from "../components/McpStream";
import { useTodaySummary, useTeamToday, useMarginSummary } from "../features/reporting/api/use-today";
import { useWorkspaceSettings } from "../features/workspace-settings/api/use-workspace-settings";
import { useMcpReports } from "../features/mcp/api/use-mcp";
import { useIsMobile } from "../lib/use-is-mobile";
import { colors } from "../theme/tokens";

function hm(min: number): string {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function Cabina() {
  const { t } = useTranslation();
  const { data: today } = useTodaySummary();
  const { data: team = [] } = useTeamToday();
  const { data: settings } = useWorkspaceSettings();
  const { data: marginSummary } = useMarginSummary();
  const { data: reports = [] } = useMcpReports();
  const isMobile = useIsMobile();
  const humanCost = today?.cost ?? 0;
  const aiCost = today?.aiCost ?? 0;
  const totalBurn = Math.round((humanCost + aiCost) * 100) / 100;
  const target = settings?.dailyCostTarget ?? 2400;
  const aiFraction = totalBurn > 0 ? aiCost / totalBurn : 0;
  return (
    <Chrome breadcrumb={t("cabina.breadcrumb")} status={t("cabina.status")}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "560px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title={t("cabina.burnRatePanel")}>
            <div className="mono" style={{ fontSize: 11, color: colors.dim, marginTop: -6, marginBottom: 8 }}>{t("cabina.dailyTarget", { target: target.toLocaleString("en-US") })}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <RingGauge total={totalBurn} target={target} aiFraction={aiFraction} caption={t("cabina.ofTarget")} size={isMobile ? 200 : 260} />
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, background: colors.coral, borderRadius: 2 }} />
                <span className="mono" style={{ fontSize: 12 }}>{t("cabina.human", { cost: humanCost })}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, background: colors.blue, borderRadius: 2 }} />
                <span className="mono" style={{ fontSize: 12 }}>{t("cabina.aiMcp", { aiCost })}</span>
              </span>
            </div>
          </Panel>
          <TileRow
            columns={isMobile ? 2 : 4}
            tiles={[
              { label: t("cabina.today"), value: today ? hm(today.trackedMinutes) : "—", sub: t("cabina.tracked") },
              { label: t("cabina.week"), value: today ? hm(today.weekMinutes) : "—", sub: t("cabina.ofForty") },
              { label: t("cabina.billable"), value: today ? hm(today.billableMinutes) : "—", accent: colors.green },
              {
                label: t("cabina.margin"),
                value: marginSummary ? `$${marginSummary.margin.toLocaleString("en-US")}` : "—",
                sub: marginSummary ? t("cabina.marginProjects", { count: marginSummary.projectCount }) : "",
                accent: marginSummary && marginSummary.margin < 0 ? colors.coral : colors.green,
              },
            ]}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title={t("cabina.teamPanel")}>
            {team.map((p, i) => (
              <PersonCostRow
                key={p.memberId}
                initials={p.initials}
                index={i}
                name={p.name}
                meta={t("cabina.trackedMeta", { time: hm(p.trackedMinutes) })}
                cost={`$${p.cost}`}
              />
            ))}
            {team.length === 0 && <div style={{ color: colors.muted, fontSize: 13 }}>{t("cabina.noActivityToday")}</div>}
          </Panel>
          <Panel title={t("cabina.mcpPanel")}>
            <McpStream
              rows={reports.slice(0, 6).map((r) => ({
                time: r.time,
                who: r.person.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(),
                task: r.task,
                hours: hm(r.minutes),
                cost: `$${r.cost}`,
                ai: r.aiSummary,
              }))}
              emptyLabel={t("cabina.noReports")}
            />
          </Panel>
        </div>
      </div>
    </Chrome>
  );
}
