import { useEffect, useState } from "react";
import { colors, radius } from "../../theme/tokens";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "Copiar" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mono"
      style={{
        fontSize: 11,
        letterSpacing: 0.5,
        color: copied ? colors.green : colors.text,
        background: colors.surface2,
        border: `1px solid ${copied ? colors.green : colors.border}`,
        borderRadius: radius.sm,
        padding: "6px 12px",
        cursor: "pointer",
      }}
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
