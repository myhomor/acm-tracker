import { useTranslation } from "react-i18next";
import { colors } from "../../theme/tokens";

export interface StackedBar {
  label: string;
  human: number;
  ai: number;
}

export function StackedBars({ data }: { data: StackedBar[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...data.map((d) => d.human + d.ai));
  const maxH = 180;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: maxH + 24 }}>
      {data.map((d) => {
        const humanHeight = (d.human / max) * maxH;
        const aiHeight = (d.ai / max) * maxH;
        return (
          <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 36, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: maxH }}>
              <div style={{ height: aiHeight, background: colors.blue, borderRadius: "3px 3px 0 0" }} />
              <div style={{ height: humanHeight, background: colors.coral }} />
            </div>
            <span className="mono" style={{ fontSize: 10, color: colors.dim }}>{d.label}</span>
          </div>
        );
      })}
      {data.length === 0 && <span style={{ color: colors.muted }}>{t("reports.emptyPeople")}</span>}
    </div>
  );
}
