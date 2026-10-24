import { useTranslation } from "react-i18next";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { DonutGauge } from "../components/DonutGauge";
import { TileRow } from "../components/TileRow";
import { DataTable } from "../components/DataTable";
import { useProjects } from "../features/projects/api/use-projects";
import { useModelPrices } from "../features/model-pricing/api/use-model-prices";
import { colors } from "../theme/tokens";

export function Costs() {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects();
  const { data: prices = [] } = useModelPrices();
  return (
    <Chrome breadcrumb={t("costs.breadcrumb")}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t("costs.title")}</h1>
      <div className="mono" style={{ fontSize: 12, color: colors.muted, marginBottom: 20 }}>
        {t("costs.subtitle")}
      </div>
      <div style={{ marginBottom: 16 }}>
        <TileRow
          tiles={[
            { label: t("costs.tileProyectosLabel"), value: String(projects.length), sub: t("costs.tileProyectosSub") },
            { label: t("costs.tileHumanoLabel"), value: "real", sub: t("costs.tileHumanoSub") },
            { label: t("costs.tileIaLabel"), value: "$0", sub: t("costs.tileIaSub"), accent: colors.blue },
            { label: t("costs.tileModelosLabel"), value: String(prices.length), sub: t("costs.tileModelosSub"), accent: colors.amber },
          ]}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16 }}>
        <Panel title={t("costs.compositionPanelTitle")}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <DonutGauge
              segments={[
                { value: 1, color: colors.coral, label: t("costs.segmentHumano") },
                { value: 0, color: colors.blue, label: t("costs.segmentIa") },
              ]}
              centerLabel={t("costs.segmentHumano")}
            />
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 12, justifyContent: "center" }}>
            <span className="mono" style={{ fontSize: 11, color: colors.coral }}>{t("costs.legendHumano")}</span>
            <span className="mono" style={{ fontSize: 11, color: colors.blue }}>{t("costs.legendIa")}</span>
          </div>
        </Panel>
        <Panel title={t("costs.modelPanelTitle")}>
          <DataTable
            columns={[
              { key: "model", label: t("costs.colModelo") },
              { key: "in", label: "Input", width: 120, align: "right" },
              { key: "out", label: "Output", width: 120, align: "right" },
              { key: "cost", label: t("costs.colCosto"), width: 100, align: "right" },
            ]}
            rows={prices.map((p) => ({
              id: p.id,
              cells: {
                model: <span className="mono">{p.model}</span>,
                in: <span className="mono" style={{ color: colors.green }}>${p.inputPer1M}</span>,
                out: <span className="mono" style={{ color: colors.green }}>${p.outputPer1M}</span>,
                cost: <span className="mono" style={{ color: colors.dim }}>$0</span>,
              },
            }))}
            emptyLabel={t("costs.emptyModels")}
          />
        </Panel>
      </div>
    </Chrome>
  );
}
