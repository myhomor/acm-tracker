import { useTranslation } from "react-i18next";
import { Panel } from "../../../components/Panel";
import { useDayEntries } from "../api/use-today-entries";
import { EntriesTimeline } from "./EntriesTimeline";
import { formatMinutes } from "../../../lib/format-minutes";

const pad = (n: number) => String(n).padStart(2, "0");
const round2 = (n: number) => Math.round(n * 100) / 100;

function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function YesterdayTimeline() {
  const { t, i18n } = useTranslation();
  const day = yesterday();
  const { data: entries = [] } = useDayEntries(isoDate(day));
  const minutes = entries.filter((e) => e.kind !== "wait").reduce((s, e) => s + e.minutes, 0);
  const waiting = entries.filter((e) => e.kind === "wait").reduce((s, e) => s + e.minutes, 0);
  const cost = round2(entries.reduce((s, e) => s + e.cost, 0));
  const ai = round2(entries.reduce((s, e) => s + e.aiCost, 0));
  const date = day.toLocaleDateString(i18n.language, { weekday: "short", day: "2-digit", month: "2-digit" });

  return (
    <Panel title={t("tracker.yesterdayPanel", { date, time: formatMinutes(minutes), wait: formatMinutes(waiting), cost, ai })}>
      <EntriesTimeline entries={entries} emptyLabel={t("tracker.emptyYesterday")} />
    </Panel>
  );
}
