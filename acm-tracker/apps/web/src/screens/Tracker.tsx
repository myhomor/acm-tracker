import { useTranslation } from "react-i18next";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { TileRow } from "../components/TileRow";
import { useTodayEntries } from "../features/time-entries/api/use-today-entries";
import { EntriesTimeline } from "../features/time-entries/components/EntriesTimeline";
import { YesterdayTimeline } from "../features/time-entries/components/YesterdayTimeline";
import { useTodaySummary } from "../features/reporting/api/use-today";
import { colors } from "../theme/tokens";

function hm(min: number): string {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function Tracker() {
  const { t } = useTranslation();
  const { data: entries = [] } = useTodayEntries();
  const { data: today } = useTodaySummary();

  return (
    <Chrome breadcrumb={t("tracker.breadcrumb")}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t("tracker.title")}</h1>
      <div className="mono" style={{ fontSize: 12, color: colors.muted, marginBottom: 20 }}>
        {t("tracker.subtitle")}
      </div>
      <div style={{ marginBottom: 16 }}>
        <TileRow
          tiles={[
            { label: t("tracker.tileTrackeadoLabel"), value: today ? hm(today.trackedMinutes) : "—" },
            { label: t("cabina.billable"), value: today ? hm(today.billableMinutes) : "—", accent: colors.green },
            { label: t("tracker.tileCostoLabel"), value: today ? `$${today.cost}` : "—" },
            { label: t("tracker.tileIaLabel"), value: today ? `$${today.aiCost}` : "—", accent: colors.blue },
            { label: t("tracker.tileWaitLabel"), value: today ? hm(today.waitMinutes) : "—", accent: colors.amber },
          ]}
          columns={5}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title={t("tracker.timelinePanel")}>
            <EntriesTimeline entries={entries} emptyLabel={t("tracker.emptyEntries")} />
          </Panel>
          <YesterdayTimeline />
        </div>
        <Panel title={t("tracker.goalPanel")}>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{today ? hm(today.trackedMinutes) : "—"} / 8h</div>
          <div style={{ height: 8, background: colors.surface2, borderRadius: 4, marginTop: 12 }}>
            <div style={{ height: 8, width: `${today ? Math.min((today.trackedMinutes / 480) * 100, 100) : 0}%`, background: colors.coral, borderRadius: 4 }} />
          </div>
        </Panel>
      </div>
    </Chrome>
  );
}
