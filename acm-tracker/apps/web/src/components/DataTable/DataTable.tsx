import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/tokens";

export interface Column {
  key: string;
  label: string;
  width?: number | string;
  align?: "left" | "right";
}

export interface Row {
  id: string;
  cells: Record<string, ReactNode>;
}

function flexFor(width?: number | string): string {
  if (width === undefined) return "1";
  return `0 0 ${typeof width === "number" ? `${width}px` : width}`;
}

export function DataTable({ columns, rows, emptyLabel }: { columns: Column[]; rows: Row[]; emptyLabel?: string }) {
  const { t } = useTranslation();
  const label = emptyLabel ?? t("common.empty");
  return (
    <div>
      <div style={{ display: "flex", padding: "0 0 8px", borderBottom: `1px solid ${colors.border}` }}>
        {columns.map((c) => (
          <span key={c.key} className="mono" style={{ fontSize: 9, letterSpacing: 1, color: colors.dim, flex: flexFor(c.width), textAlign: c.align ?? "left" }}>
            {c.label.toUpperCase()}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {columns.map((c) => (
            <span key={c.key} style={{ flex: flexFor(c.width), textAlign: c.align ?? "left" }}>
              {r.cells[c.key]}
            </span>
          ))}
        </div>
      ))}
      {rows.length === 0 && <div style={{ color: colors.muted, fontSize: 13, padding: "12px 0" }}>{label}</div>}
    </div>
  );
}
