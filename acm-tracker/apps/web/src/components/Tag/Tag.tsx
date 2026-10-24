import { colors } from "../../theme/tokens";

export function Tag({ label, color = colors.muted }: { label: string; color?: string }) {
  return (
    <span className="mono" style={{ fontSize: 10, letterSpacing: 0.5, color, border: `1px solid ${color}`, borderRadius: 6, padding: "2px 8px" }}>
      {label}
    </span>
  );
}
