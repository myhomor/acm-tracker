import { colors, radius } from "../../theme/tokens";

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function StatTile({ label, value, sub, accent = colors.text }: StatTileProps) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 18 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: colors.muted }}>{label.toUpperCase()}</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: accent, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: colors.dim, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
