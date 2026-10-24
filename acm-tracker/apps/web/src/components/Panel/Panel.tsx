import type { CSSProperties, ReactNode } from "react";
import { colors, radius } from "../../theme/tokens";

interface PanelProps {
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function Panel({ title, children, style }: PanelProps) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: 20,
        ...style,
      }}
    >
      {title && (
        <div
          className="mono"
          style={{ fontSize: 11, letterSpacing: 1.5, color: colors.muted, marginBottom: 12 }}
        >
          {title.toUpperCase()}
        </div>
      )}
      {children}
    </div>
  );
}
