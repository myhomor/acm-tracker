import { useEffect, useState } from "react";
import { colors } from "../../theme/tokens";

interface TimerProps {
  taskLabel: string;
  onStop: (minutes: number) => void;
  onManual: () => void;
}

function format(totalSeconds: number): string {
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function Timer({ taskLabel, onStop, onManual }: TimerProps) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const stop = () => {
    setRunning(false);
    onStop(Math.round(seconds / 60));
    setSeconds(0);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: colors.surface2,
        border: `1.5px solid ${colors.coral}`,
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      <span className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{format(seconds)}</span>
      <span style={{ color: colors.muted }}>{taskLabel}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          onClick={() => setRunning((r) => !r)}
          style={{ background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700 }}
        >
          {running ? "❚❚ Pausa" : "▶ Iniciar"}
        </button>
        <button
          onClick={stop}
          style={{ background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 16px" }}
        >
          ◼ Stop
        </button>
        <button
          onClick={onManual}
          style={{ background: "transparent", color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 16px" }}
        >
          + manual
        </button>
      </div>
    </div>
  );
}
