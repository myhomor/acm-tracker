import { useTranslation } from "react-i18next";
import { useTaskCost } from "../../time-entries/api/use-time-entries";
import { useTimeEntryModal } from "../../time-entries/use-time-entry-modal";
import { useStartTimer } from "../../timer/api/use-timer";
import { colors } from "../../../theme/tokens";

function hm(min: number): string {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function TaskRealCell({ taskId }: { taskId: string }) {
  const { data: cost } = useTaskCost(taskId);
  return <span className="mono" style={{ color: colors.muted }}>{cost ? hm(cost.minutes) : "—"}</span>;
}

export function TaskCostCell({ taskId }: { taskId: string }) {
  const { data: cost } = useTaskCost(taskId);
  return <span className="mono" style={{ fontWeight: 700 }}>{cost ? `$${cost.total}` : "—"}</span>;
}

export function AddTimeButton({ taskId, projectId }: { taskId: string; projectId: string }) {
  const { t } = useTranslation();
  const openModal = useTimeEntryModal((s) => s.openModal);
  return (
    <button onClick={() => openModal({ taskId, projectId })} aria-label={t("tracker.addTimeAria")} style={{ background: "transparent", color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 12px" }}>
      {t("tracker.addTimeButton")}
    </button>
  );
}

export function StartTimerButton({ taskId, taskCode }: { taskId: string; taskCode: string }) {
  const { t } = useTranslation();
  const startTimer = useStartTimer();
  return (
    <button
      data-testid={`start-timer-${taskCode}`}
      onClick={() => startTimer.mutate(taskId)}
      disabled={startTimer.isPending}
      title={t("timer.startForTask")}
      aria-label={t("timer.startForTask")}
      style={{ background: "transparent", color: colors.coral, border: `1px solid ${colors.coral}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", marginRight: 4 }}
    >▶</button>
  );
}
