import { colors } from "../../theme/tokens";

export interface NavItem {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function SideNav({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <nav style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, minWidth: 220 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: colors.dim, marginBottom: 12 }}>{title.toUpperCase()}</div>
      {items.map((it) => (
        <button
          key={it.label}
          onClick={it.onClick}
          style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: it.active ? colors.text : colors.muted, fontWeight: it.active ? 600 : 400, padding: "8px 0 8px 10px", borderLeft: it.active ? `2px solid ${colors.coral}` : "2px solid transparent" }}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}
