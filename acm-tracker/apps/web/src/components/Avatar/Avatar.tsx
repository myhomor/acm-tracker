import { colors } from "../../theme/tokens";

const PALETTE = [colors.coral, colors.blue, colors.green, colors.amber];

export function Avatar({ initials, index = 0, size = 34 }: { initials: string; index?: number; size?: number }) {
  const bg = PALETTE[index % PALETTE.length];
  return (
    <span
      className="mono"
      style={{ width: size, height: size, borderRadius: 8, background: bg, color: colors.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700 }}
    >
      {initials}
    </span>
  );
}
