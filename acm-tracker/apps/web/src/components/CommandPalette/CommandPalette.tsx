import { useTranslation } from "react-i18next";
import { colors } from "../../theme/tokens";

export interface Command {
  icon: string;
  label: string;
  hint?: string;
  onRun: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 160, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 600, background: colors.surface, border: `1px solid ${colors.borderStrong}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px", background: colors.surface2 }}>
          <span className="mono" style={{ color: colors.coral, fontSize: 18 }}>⌘</span>
          <span style={{ color: colors.dim }}>{t("palette.searchPlaceholder")}</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: colors.dim }}>ESC</span>
        </div>
        <div style={{ padding: 12 }}>
          {commands.map((c, i) => (
            <button
              key={i}
              onClick={() => { c.onRun(); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "transparent", border: "none", color: colors.text, padding: "10px 12px", borderRadius: 8 }}
            >
              <span className="mono" style={{ color: colors.muted, width: 18 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>{c.label}</span>
              {c.hint && <span className="mono" style={{ fontSize: 11, color: colors.dim }}>{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
