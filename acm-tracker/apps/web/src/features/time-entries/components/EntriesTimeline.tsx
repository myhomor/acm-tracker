import { useTranslation } from "react-i18next";
import { DataTable } from "../../../components/DataTable";
import { Tag } from "../../../components/Tag";
import type { TodayEntryView } from "../api/use-today-entries";
import { colors } from "../../../theme/tokens";

const HUMAN_ORIGINS = new Set(["manual", "timer"]);

function hm(min: number): string {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function EntriesTimeline({ entries, emptyLabel }: { entries: TodayEntryView[]; emptyLabel: string }) {
  const { t } = useTranslation();
  return (
    <DataTable
      columns={[
        { key: "time", label: t("tracker.colHora"), width: 70 },
        { key: "origin", label: t("tracker.colOrigen"), width: 130 },
        { key: "who", label: t("tracker.colWho"), width: 150 },
        { key: "task", label: t("tracker.colTarea") },
        { key: "dur", label: t("tracker.colDuracion"), width: 100, align: "right" },
        { key: "cost", label: t("tracker.colCosto"), width: 80, align: "right" },
      ]}
      rows={entries.map((e) => ({
        id: e.id,
        cells: {
          time: <span className="mono" style={{ color: colors.dim }}>{e.time}</span>,
          origin: (
            <Tag
              label={t(`tracker.origin.${e.origin}`, { defaultValue: e.origin })}
              color={HUMAN_ORIGINS.has(e.origin) ? colors.green : colors.blue}
            />
          ),
          who: <span style={{ color: colors.muted, fontSize: 13 }}>{e.memberName}</span>,
          task: (
            <div>
              <span style={{ fontWeight: 500 }}>{e.taskCode} · {e.taskTitle}</span>
              {e.note && <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{e.note}</div>}
            </div>
          ),
          dur: <span className="mono" style={{ color: colors.muted }}>{hm(e.minutes)}</span>,
          cost: <span className="mono" style={{ fontWeight: 700 }}>${e.cost}</span>,
        },
      }))}
      emptyLabel={emptyLabel}
    />
  );
}
