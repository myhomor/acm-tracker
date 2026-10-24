import { useTranslation } from "react-i18next";
import { Panel } from "../../../components/Panel";
import { CopyButton } from "../../../components/CopyButton";
import { useMcpConfig } from "../api/use-mcp";
import { colors, radius } from "../../../theme/tokens";

const REPORT_PATH = "/api/mcp/report-work";

interface McpEndpointPanelProps {
  reportCount: number;
}

export function McpEndpointPanel({ reportCount }: McpEndpointPanelProps) {
  const { t } = useTranslation();
  const { data: config } = useMcpConfig();
  const baseUrl = config?.apiUrl ?? window.location.origin;
  const url = `${baseUrl}${REPORT_PATH}`;

  return (
    <Panel title={t("mcp.endpointPanelTitle")}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          className="mono"
          style={{
            flex: 1,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.sm,
            padding: "12px 14px",
            color: colors.green,
            wordBreak: "break-all",
          }}
        >
          POST {url}
        </div>
        <CopyButton text={url} label={t("mcp.copyUrl")} />
      </div>
      <div className="mono" style={{ fontSize: 11, color: colors.dim, marginTop: 12 }}>
        {t("mcp.activeStatus", { count: reportCount })}
      </div>
    </Panel>
  );
}
