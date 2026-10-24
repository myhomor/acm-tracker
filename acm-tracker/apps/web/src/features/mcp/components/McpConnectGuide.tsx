import { useTranslation } from "react-i18next";
import { Panel } from "../../../components/Panel";
import { CopyButton } from "../../../components/CopyButton";
import { useMcpConfig } from "../api/use-mcp";
import type { McpClaudeConfig } from "../api/use-mcp";
import { colors, radius } from "../../../theme/tokens";

function buildFallbackConfig(): McpClaudeConfig {
  return {
    mcpServers: {
      "acm-tracker": {
        command: "node",
        args: ["<ruta-de-tu-MCP>/dist/index.js"],
        env: { ACM_API_URL: window.location.origin },
      },
    },
  };
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 10 }}>
      {steps.map((step) => (
        <li key={step} style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
          {step}
        </li>
      ))}
    </ol>
  );
}

export function McpConnectGuide() {
  const { t } = useTranslation();
  const { data: config, isLoading } = useMcpConfig();

  const panelTitle = t("mcp.connectPanelTitle");
  const steps = [t("mcp.step1"), t("mcp.step2"), t("mcp.step3"), t("mcp.step4")];

  if (isLoading) {
    return (
      <Panel title={panelTitle} style={{ marginTop: 16 }}>
        <div className="mono" style={{ fontSize: 12, color: colors.dim }}>
          {t("mcp.loadingConfig")}
        </div>
      </Panel>
    );
  }

  const claudeConfig = config?.claudeConfig ?? buildFallbackConfig();
  const showPathWarning = !config || config.mcpServerPath === null;
  const json = JSON.stringify(claudeConfig, null, 2);

  return (
    <Panel title={panelTitle} style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <StepList steps={steps} />
      </div>

      {showPathWarning && (
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: colors.amber,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.sm,
            padding: "10px 12px",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {t("mcp.pathWarning")}
          {"\n"}node packages/mcp/dist/index.js
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: 0.5, color: colors.muted }}>
          {t("mcp.configLabel")}
        </span>
        <CopyButton text={json} label={t("mcp.copyConfig")} />
      </div>
      <pre
        className="mono"
        style={{
          fontSize: 11,
          color: colors.text,
          background: colors.surface2,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.sm,
          padding: "12px 14px",
          margin: 0,
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
        }}
      >
        {json}
      </pre>
    </Panel>
  );
}
