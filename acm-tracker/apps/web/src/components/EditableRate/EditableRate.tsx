import { useState } from "react";
import { colors, radius } from "../../theme/tokens";

type RateFormat = "money" | "hours";

interface EditableRateProps {
  value: number;
  label: string;
  format?: RateFormat;
  saving?: boolean;
  onSave: (next: number) => void;
}

function parseRate(raw: string): number | null {
  const n = Number(raw);
  if (raw.trim() === "" || Number.isNaN(n) || n < 0) return null;
  return n;
}

function formatValue(value: number, format: RateFormat): string {
  if (format === "hours") {
    const hours = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return `${hours} h`;
  }
  return `$${value.toFixed(2)}`;
}

export function EditableRate({ value, label, format = "money", saving = false, onSave }: EditableRateProps) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const [draft, setDraft] = useState("");

  const open = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const next = parseRate(draft);
    setEditing(false);
    if (next !== null && next !== value) onSave(next);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={`Editar ${label}`}
        title="Clic para editar"
        className="mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: hover ? colors.surface2 : "transparent",
          border: "none",
          borderRadius: radius.sm,
          color: saving ? colors.amber : colors.text,
          cursor: "pointer",
          font: "inherit",
          padding: "2px 6px",
          textDecoration: hover ? "underline dotted" : "none",
          textUnderlineOffset: 3,
        }}
      >
        <span>{formatValue(value, format)}</span>
        <span aria-hidden style={{ color: hover ? colors.muted : colors.dim, fontSize: "0.85em" }}>
          ✎
        </span>
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      min={0}
      step={format === "hours" ? 1 : 0.5}
      value={draft}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="mono"
      style={{
        width: 80,
        textAlign: "right",
        background: colors.surface2,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.sm,
        color: colors.text,
        padding: "4px 8px",
        font: "inherit",
      }}
    />
  );
}
