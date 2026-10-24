import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TimerDock } from "../../../components/TimerDock";
import { useActiveTimer, useStopTimer } from "../api/use-timer";
import { useElapsed } from "../use-elapsed";
import { useTimerPicker } from "../use-timer-picker";
import { useTimeEntryModal } from "../../time-entries/use-time-entry-modal";

export function GlobalTimerDock() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { data: active } = useActiveTimer();
  const stopTimer = useStopTimer();
  const openPicker = useTimerPicker((s) => s.openPicker);
  const openManual = useTimeEntryModal((s) => s.openModal);
  const elapsed = useElapsed(active?.startedAt);

  if (pathname === "/auth") return null;

  return (
    <div style={{ position: "fixed", left: 106, right: 28, bottom: 12, zIndex: 40 }}>
      <TimerDock
        running={Boolean(active)}
        elapsed={elapsed}
        taskTitle={active ? `${active.taskCode} · ${active.taskTitle}` : t("cabina.noActiveTask")}
        meta={active ? `${active.projectName} · $${active.ratePerHour.toFixed(2)}/h` : t("cabina.pickProject")}
        labels={{
          running: t("timer.running"),
          idle: t("timer.idle"),
          stop: t("timer.stop"),
          start: t("timer.start"),
          manual: t("cabina.manualEntry"),
        }}
        onStop={() => stopTimer.mutate()}
        stopDisabled={stopTimer.isPending}
        onStart={openPicker}
        onManual={() => openManual()}
      />
    </div>
  );
}
