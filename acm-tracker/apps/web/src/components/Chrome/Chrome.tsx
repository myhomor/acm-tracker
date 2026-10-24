import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme/tokens";

interface ChromeProps {
  breadcrumb: string;
  status?: string;
  statusColor?: string;
  children: ReactNode;
}

interface NavLink {
  to: string;
  icon: string;
  key: string;
}

const NAV: NavLink[] = [
  { to: "/", icon: "◆", key: "cabina" },
  { to: "/projects", icon: "⊞", key: "projects" },
  { to: "/tracker", icon: "◷", key: "tracker" },
  { to: "/costs", icon: "$", key: "costs" },
  { to: "/reports", icon: "▤", key: "reports" },
  { to: "/documents", icon: "⎙", key: "documents" },
  { to: "/mcp", icon: "◇", key: "mcp" },
  { to: "/notifications", icon: "◔", key: "notifications" },
  { to: "/settings", icon: "✎", key: "settings" },
];

function Mark({ pos }: { pos: CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 14, height: 14, ...pos }}>
      <div style={{ position: "absolute", width: 14, height: 1, background: colors.coral, opacity: 0.7 }} />
      <div style={{ position: "absolute", width: 1, height: 14, background: colors.coral, opacity: 0.7 }} />
    </div>
  );
}

function Sidebar() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  return (
    <nav
      style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 78, background: colors.surface, borderRight: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", gap: 6, zIndex: 20 }}
    >
      <Link to="/" title="ACM-TRACKER" style={{ color: colors.coral, fontWeight: 700, fontSize: 18, marginBottom: 14, textDecoration: "none" }}>◆</Link>
      {NAV.map((n) => {
        const active = isActive(n.to);
        const label = t(`nav.${n.key}`);
        return (
          <Link
            key={n.to}
            to={n.to}
            title={label}
            aria-label={label}
            style={{ width: 64, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 10, textDecoration: "none", fontSize: 16, color: active ? colors.coral : colors.muted, background: active ? colors.surface2 : "transparent", borderLeft: active ? `2px solid ${colors.coral}` : "2px solid transparent", padding: "4px 0" }}
          >
            <span>{n.icon}</span>
            <span className="mono" style={{ fontSize: 8, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Chrome({ breadcrumb, status = "LIVE", statusColor = colors.green, children }: ChromeProps) {
  return (
    <div className="grid-bg" style={{ minHeight: "100vh", position: "relative", padding: 28, paddingLeft: 106, paddingBottom: 110 }}>
      <Sidebar />
      <Mark pos={{ top: 14, left: 92 }} />
      <Mark pos={{ top: 14, right: 14 }} />
      <Mark pos={{ bottom: 14, left: 92 }} />
      <Mark pos={{ bottom: 14, right: 14 }} />
      <header style={{ display: "flex", alignItems: "center", height: 52, padding: "0 20px", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 24 }}>
        <span className="mono" style={{ color: colors.coral, fontWeight: 700, letterSpacing: 1 }}>◆ ACM-TRACKER</span>
        <span className="mono" style={{ color: colors.muted, marginLeft: 24, fontSize: 13 }}>{breadcrumb}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: statusColor }} />
          <span className="mono" style={{ color: statusColor, fontSize: 12, letterSpacing: 1 }}>{status}</span>
          <span className="mono" style={{ color: colors.text, fontSize: 13, marginLeft: 16 }}>HG ▾</span>
        </span>
      </header>
      {children}
    </div>
  );
}
