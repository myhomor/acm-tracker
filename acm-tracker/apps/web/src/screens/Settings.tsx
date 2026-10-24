import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { SideNav } from "../components/SideNav";
import { DataTable } from "../components/DataTable";
import { Tag } from "../components/Tag";
import { Avatar } from "../components/Avatar";
import { EditableRate } from "../components/EditableRate";
import { useMembers, useUpdateMember } from "../features/members/api/use-members";
import { useModelPrices, useCreateModelPrice } from "../features/model-pricing/api/use-model-prices";
import { ModelPriceList } from "../features/model-pricing/components/ModelPriceList";
import { useWorkspaceSettings, useUpdateWorkspaceSettings } from "../features/workspace-settings/api/use-workspace-settings";
import { useLang } from "../i18n/use-lang";
import { colors } from "../theme/tokens";

const inputStyle = {
  background: colors.surface2,
  border: `1px solid ${colors.border}`,
  color: colors.text,
  borderRadius: 8,
  padding: "8px 10px",
} as const;

function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

type Section = "members" | "pricing" | "preferences";

export function Settings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { lang, setLang, langs } = useLang();
  const { data: members = [] } = useMembers();
  const updateMember = useUpdateMember();
  const { data: prices = [] } = useModelPrices();
  const createPrice = useCreateModelPrice();
  const { data: settings } = useWorkspaceSettings();
  const updateSettings = useUpdateWorkspaceSettings();
  const [section, setSection] = useState<Section>("members");
  const owner = members.find((m) => m.role === "owner") ?? members[0];
  const [model, setModel] = useState("");
  const [inputPer1M, setInputPer1M] = useState("");
  const [outputPer1M, setOutputPer1M] = useState("");

  const addPrice = () => {
    if (!model.trim()) return;
    createPrice.mutate(
      { provider: "anthropic", model: model.trim(), inputPer1M: Number(inputPer1M) || 0, outputPer1M: Number(outputPer1M) || 0 },
      { onSuccess: () => { setModel(""); setInputPer1M(""); setOutputPer1M(""); } },
    );
  };

  return (
    <Chrome breadcrumb="/ settings / workspace">
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>
        <SideNav
          title={t("settings.title")}
          items={[
            { label: t("settings.navMembers"), active: section === "members", onClick: () => setSection("members") },
            { label: t("settings.navPricing"), active: section === "pricing", onClick: () => setSection("pricing") },
            { label: t("settings.preferences"), active: section === "preferences", onClick: () => setSection("preferences") },
            { label: t("settings.navMcp"), onClick: () => navigate("/mcp") },
            { label: t("settings.navNotifications"), onClick: () => navigate("/notifications") },
          ]}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {section === "members" && (
            <>
              <Panel title={t("settings.membersPanel")}>
                <DataTable
                  columns={[
                    { key: "person", label: t("settings.colPerson") },
                    { key: "role", label: t("settings.colRole"), width: 160 },
                    { key: "rate", label: t("settings.colRate"), width: 120, align: "right" },
                    { key: "state", label: t("settings.colState"), width: 110, align: "right" },
                  ]}
                  rows={members.map((m, i) => ({
                    id: m.id,
                    cells: {
                      person: (
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar initials={initialsOf(m.name)} index={i} size={30} />
                          <span style={{ fontWeight: 600 }}>{m.name}</span>
                        </span>
                      ),
                      role: <span className="mono" style={{ color: colors.muted, fontSize: 12 }}>{m.role}</span>,
                      rate: (
                        <EditableRate
                          value={m.ratePerHour}
                          label={m.name}
                          saving={updateMember.isPending && updateMember.variables?.id === m.id}
                          onSave={(ratePerHour) => updateMember.mutate({ id: m.id, ratePerHour })}
                        />
                      ),
                      state: <Tag label={t("settings.tagActive")} color={colors.green} />,
                    },
                  }))}
                />
              </Panel>

              <Panel title={t("settings.authPanel")}>
                <p style={{ color: colors.muted, fontSize: 13 }}>
                  {t("settings.authModeLabel")} <b className="mono" style={{ color: colors.green }}>{t("settings.authModeValue")}</b>
                </p>
              </Panel>
            </>
          )}

          {section === "pricing" && (
            <Panel title={t("settings.pricingPanel")}>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("settings.modelPlaceholder")} aria-label={t("settings.modelAriaLabel")} style={{ ...inputStyle, flex: 2 }} />
                <input value={inputPer1M} onChange={(e) => setInputPer1M(e.target.value)} placeholder="in" aria-label={t("settings.inputPriceAriaLabel")} style={{ ...inputStyle, width: 70 }} />
                <input value={outputPer1M} onChange={(e) => setOutputPer1M(e.target.value)} placeholder="out" aria-label={t("settings.outputPriceAriaLabel")} style={{ ...inputStyle, width: 70 }} />
                <button onClick={addPrice} disabled={createPrice.isPending} style={{ background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700 }}>
                  {t("settings.addButton")}
                </button>
              </div>
              <ModelPriceList prices={prices} />
            </Panel>
          )}

          {section === "preferences" && (
            <>
              <Panel title={t("settings.language")}>
                <div style={{ display: "flex", gap: 8 }} data-testid="lang-toggle">
                  {langs.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      data-testid={`lang-${l}`}
                      style={{
                        ...inputStyle,
                        cursor: "pointer",
                        borderColor: lang === l ? colors.coral : colors.border,
                        color: lang === l ? colors.coral : colors.text,
                      }}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </Panel>
              {owner && (
                <Panel title={t("settings.myRate")}>
                  <EditableRate
                    label={t("settings.myRateLabel", { name: owner.name })}
                    value={owner.ratePerHour}
                    saving={updateMember.isPending && updateMember.variables?.id === owner.id}
                    onSave={(ratePerHour) => updateMember.mutate({ id: owner.id, ratePerHour })}
                  />
                  <p style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>{t("settings.myRateHint")}</p>
                </Panel>
              )}
              <Panel title={t("settings.budget")}>
                <EditableRate
                  label={t("settings.dailyTarget")}
                  value={settings?.dailyCostTarget ?? 2400}
                  saving={updateSettings.isPending}
                  onSave={(next) => updateSettings.mutate({ dailyCostTarget: next })}
                />
              </Panel>
            </>
          )}
        </div>
      </div>
    </Chrome>
  );
}
