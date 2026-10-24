import { useTranslation } from "react-i18next";
import { Panel } from "../../../components/Panel";
import { DonutGauge } from "../../../components/DonutGauge";
import { TileRow } from "../../../components/TileRow";
import { colors } from "../../../theme/tokens";

interface ProjectMarginPanelProps {
  human: number;
  minutes: number;
  estimateHours: number | null;
  estimatedCost: number | null;
  revenue: number | null;
  margin: number | null;
  marginPerHour: number | null;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const hours = (n: number) => `${Math.round(n * 10) / 10}h`;

export function ProjectMarginPanel(props: ProjectMarginPanelProps) {
  const { t } = useTranslation();
  const { human, minutes, estimateHours, estimatedCost, revenue, margin, marginPerHour } = props;
  const realHours = minutes / 60;
  const marginAccent = margin != null && margin < 0 ? colors.coral : colors.green;

  return (
    <Panel title={t("projects.marginPanelTitle")}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        {margin == null ? (
          <DonutGauge
            segments={[{ value: 1, color: colors.surface2, label: t("projects.segmentNoRate") }]}
            centerLabel="—"
          />
        ) : (
          <DonutGauge
            segments={marginSegments(margin, human, t)}
            centerLabel={money(margin)}
          />
        )}
      </div>
      {margin == null ? (
        <div style={{ fontSize: 12, color: colors.dim, textAlign: "center" }}>
          {t("projects.defineRateShort")}
        </div>
      ) : (
        <TileRow
          columns={2}
          tiles={[
            { label: t("projects.tileEstimatedTotal"), value: estimatedCost != null ? money(estimatedCost) : "—" },
            { label: t("projects.tileRealRevenue"), value: revenue != null ? money(revenue) : "—" },
            { label: t("projects.tileRealCost"), value: money(human) },
            { label: t("projects.tileMargin"), value: money(margin), accent: marginAccent },
            {
              label: t("projects.tileMarginPerHour"),
              value: marginPerHour != null ? money(marginPerHour) : "—",
              accent: marginAccent,
            },
            {
              label: t("projects.tileHoursEstVsReal"),
              value: `${estimateHours != null ? hours(estimateHours) : "—"} / ${hours(realHours)}`,
            },
          ]}
        />
      )}
    </Panel>
  );
}

function marginSegments(margin: number, human: number, t: (k: string) => string) {
  if (margin < 0) {
    return [{ value: 1, color: colors.coral, label: t("projects.segmentLoss") }];
  }
  return [
    { value: margin, color: colors.green, label: t("projects.segmentMargin") },
    { value: human, color: colors.surface2, label: t("projects.segmentCost") },
  ];
}
