import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { useNotificationRules, useCreateNotificationRule, useToggleNotificationRule, useDeleteNotificationRule } from "../features/notifications/api/use-notification-rules";
import { colors } from "../theme/tokens";

const CHANNELS = ["Slack", "Email", "WhatsApp", "Webhook"];

const inputStyle = {
  background: colors.surface2,
  border: `1px solid ${colors.border}`,
  color: colors.text,
  borderRadius: 8,
  padding: "8px 10px",
} as const;

export function Notifications() {
  const { t } = useTranslation();
  const { data: rules = [] } = useNotificationRules();
  const createRule = useCreateNotificationRule();
  const toggleRule = useToggleNotificationRule();
  const deleteRule = useDeleteNotificationRule();
  const [event, setEvent] = useState("");
  const [condition, setCondition] = useState("");
  const [channel, setChannel] = useState("Slack");

  const add = () => {
    if (!event.trim()) return;
    createRule.mutate(
      { event: event.trim(), condition: condition.trim() || "—", channel },
      { onSuccess: () => { setEvent(""); setCondition(""); } },
    );
  };

  return (
    <Chrome breadcrumb={t("notifications.breadcrumb")}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t("notifications.title")}</h1>
      <div className="mono" style={{ fontSize: 12, color: colors.muted, marginBottom: 16 }}>
        {t("notifications.subtitle")}
      </div>
      <div style={{ background: colors.surface, border: `1px solid ${colors.amber}`, borderRadius: 10, padding: 16, marginBottom: 16, color: colors.text, fontSize: 13 }}>
        {t("notifications.infoBanner")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        {CHANNELS.map((c) => (
          <Panel key={c} title={c}>
            <div className="mono" style={{ fontSize: 11, color: colors.muted }}>{t("notifications.channelStatus")}</div>
          </Panel>
        ))}
      </div>

      <Panel title={t("notifications.rulesPanelTitle")}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder={t("notifications.eventPlaceholder")} aria-label={t("notifications.eventLabel")} style={{ ...inputStyle, flex: 2 }} />
          <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder={t("notifications.conditionLabel")} aria-label={t("notifications.conditionLabel")} style={{ ...inputStyle, flex: 2 }} />
          <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label={t("notifications.channelLabel")} style={{ ...inputStyle, width: 130 }}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={add} disabled={createRule.isPending} style={{ background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700 }}>
            {t("notifications.addRuleButton")}
          </button>
        </div>
        <DataTable
          columns={[
            { key: "event", label: t("notifications.eventLabel") },
            { key: "condition", label: t("notifications.conditionLabel") },
            { key: "channel", label: t("notifications.channelLabel"), width: 120 },
            { key: "toggle", label: t("notifications.colToggle"), width: 70, align: "right" },
            { key: "action", label: "", width: 80, align: "right" },
          ]}
          rows={rules.map((r) => ({
            id: r.id,
            cells: {
              event: <span style={{ fontWeight: 600 }}>{r.event}</span>,
              condition: <span style={{ color: colors.muted, fontSize: 12 }}>{r.condition}</span>,
              channel: <span className="mono" style={{ color: colors.coral, fontSize: 12 }}>{r.channel}</span>,
              toggle: (
                <button
                  onClick={() => toggleRule.mutate({ id: r.id, enabled: !r.enabled })}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: r.enabled ? colors.green : colors.surface2, position: "relative" }}
                  aria-label={t("notifications.toggleAriaLabel", { event: r.event })}
                >
                  <span style={{ position: "absolute", top: 3, left: r.enabled ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left .15s" }} />
                </button>
              ),
              action: (
                <button onClick={() => deleteRule.mutate(r.id)} aria-label={t("notifications.deleteAriaLabel", { event: r.event })} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                  {t("common.delete")}
                </button>
              ),
            },
          }))}
          emptyLabel={t("notifications.emptyRules")}
        />
      </Panel>
    </Chrome>
  );
}
