import { colors } from "../../theme/tokens";

export interface TimerDockLabels {
  running: string;
  idle: string;
  stop: string;
  start: string;
  manual: string;
}

interface TimerDockProps {
  running: boolean;
  elapsed: string;
  taskTitle: string;
  meta: string;
  labels: TimerDockLabels;
  onStop: () => void;
  onStart: () => void;
  onManual: () => void;
  stopDisabled?: boolean;
}

const btn = { border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer" } as const;

export function TimerDock({ running, elapsed, taskTitle, meta, labels, onStop, onStart, onManual, stopDisabled }: TimerDockProps) {
  return (
    <div data-testid="timer-dock" style={{ display: "flex", alignItems: "center", gap: 20, background: colors.surface2, border: `1.5px solid ${colors.coral}`, borderRadius: 12, padding: "14px 24px" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: colors.coral, letterSpacing: 1.5 }}>
          {running ? `● ${labels.running}` : `○ ${labels.idle}`}
        </div>
        <div data-testid="timer-elapsed" className="mono" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{elapsed}</div>
      </div>
      <div style={{ marginLeft: 12 }}>
        <div style={{ fontWeight: 600 }}>{taskTitle}</div>
        <div className="mono" style={{ fontSize: 12, color: colors.muted }}>{meta}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
        {running ? (
          <button data-testid="timer-stop" onClick={onStop} disabled={stopDisabled} style={{ ...btn, background: colors.coral, color: colors.bg }}>◼ {labels.stop}</button>
        ) : (
          <button data-testid="timer-start" onClick={onStart} style={{ ...btn, background: colors.coral, color: colors.bg }}>▶ {labels.start}</button>
        )}
        <button onClick={onManual} style={{ ...btn, background: "transparent", color: colors.text, border: `1px solid ${colors.border}` }}>{labels.manual}</button>
      </div>
    </div>
  );
}
