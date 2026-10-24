import { useTranslation } from "react-i18next";
import type { ModelPrice } from "@acm/shared";
import { ModelPriceRow } from "./ModelPriceRow";
import { colors } from "../../../theme/tokens";

export function ModelPriceList({ prices }: { prices: ModelPrice[] }) {
  const { t } = useTranslation();

  const headers: { label: string; flex: string; align: "left" | "right" }[] = [
    { label: t("settings.colModel"), flex: "1", align: "left" },
    { label: t("settings.colProvider"), flex: "0 0 130px", align: "left" },
    { label: "Input", flex: "0 0 90px", align: "right" },
    { label: "Output", flex: "0 0 90px", align: "right" },
    { label: "", flex: "0 0 150px", align: "right" },
  ];

  return (
    <div>
      <div style={{ display: "flex", padding: "0 0 8px", borderBottom: `1px solid ${colors.border}` }}>
        {headers.map((h, i) => (
          <span key={i} className="mono" style={{ fontSize: 9, letterSpacing: 1, color: colors.dim, flex: h.flex, textAlign: h.align }}>
            {h.label.toUpperCase()}
          </span>
        ))}
      </div>
      {prices.map((p) => <ModelPriceRow key={p.id} price={p} />)}
      {prices.length === 0 && <div style={{ color: colors.muted, fontSize: 13, padding: "12px 0" }}>{t("settings.emptyPrices")}</div>}
    </div>
  );
}
