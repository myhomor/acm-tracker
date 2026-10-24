import { useTranslation } from "react-i18next";
import { colors } from "../../theme/tokens";

export interface McpStreamRow {
  time: string;
  who: string;
  task: string;
  hours: string;
  cost: string;
  ai: string;
  aiColor?: string;
}

export function McpStream({ rows, emptyLabel }: { rows: McpStreamRow[]; emptyLabel?: string }) {
  const { t } = useTranslation();
  const empty = emptyLabel ?? t("mcp.emptyStream");
  if (rows.length === 0) {
    return <div style={{ color: colors.muted, fontSize: 13, padding: "12px 0" }}>{empty}</div>;
  }
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="mono" style={{ fontSize: 12, color: colors.dim, width: 52 }}>{r.time}</span>
          <span className="mono" style={{ fontSize: 12, color: colors.coral, fontWeight: 700, width: 30 }}>{r.who}</span>
          <span style={{ flex: 1, fontWeight: 500 }}>{r.task}</span>
          <span className="mono" style={{ fontSize: 12, color: colors.muted, width: 60 }}>{r.hours}</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, width: 56 }}>{r.cost}</span>
          <span className="mono" style={{ fontSize: 11, color: r.aiColor ?? colors.dim, width: 190 }}>{r.ai}</span>
        </div>
      ))}
    </div>
  );
}
