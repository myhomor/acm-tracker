import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjects } from "../../projects/api/use-projects";
import { useTasks } from "../../tasks/api/use-tasks";
import { useStartTimer } from "../api/use-timer";
import { useTimerPicker } from "../use-timer-picker";
import { colors } from "../../../theme/tokens";

const field = {
  width: "100%",
  background: colors.surface2,
  border: `1px solid ${colors.border}`,
  color: colors.text,
  borderRadius: 8,
  padding: "10px 12px",
  marginTop: 6,
} as const;

const labelStyle = { fontSize: 11, letterSpacing: 1, color: colors.muted } as const;

export function TimerStartModal() {
  const { t } = useTranslation();
  const { open, close } = useTimerPicker();
  const { data: projects = [] } = useProjects();
  const [projectId, setProjectId] = useState("");
  const { data: tasks = [] } = useTasks(projectId);
  const [taskId, setTaskId] = useState("");
  const startTimer = useStartTimer();

  useEffect(() => {
    if (!open) return;
    setProjectId(projects[0]?.id ?? "");
    setTaskId("");
  }, [open, projects]);

  useEffect(() => {
    if (tasks.length > 0 && !tasks.some((t) => t.id === taskId)) {
      setTaskId(tasks[0].id);
    }
  }, [tasks, taskId]);

  if (!open) return null;

  const canStart = Boolean(taskId) && !startTimer.isPending;

  const start = () => {
    if (!canStart) return;
    startTimer.mutate(taskId, { onSuccess: () => close() });
  };

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 140, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("timer.pickerAriaLabel")} style={{ width: 480, background: colors.surface, border: `1px solid ${colors.borderStrong}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t("timer.pickerTitle")}</h3>
        <p className="mono" style={{ fontSize: 11, color: colors.muted, marginBottom: 20 }}>{t("timer.pickerSubtitle")}</p>

        <label style={labelStyle}>{t("tracker.modalProjectLabel")}</label>
        <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }} aria-label={t("tracker.modalProjectAriaLabel")} style={field}>
          {projects.length === 0 && <option value="">{t("tracker.modalNoProjects")}</option>}
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>{t("tracker.modalTaskLabel")}</label>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label={t("tracker.modalTaskAriaLabel")} style={field}>
            {tasks.length === 0 && <option value="">{t("tracker.modalNoTasks")}</option>}
            {tasks.map((tk) => <option key={tk.id} value={tk.id}>{tk.code} · {tk.title}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={close} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 18px" }}>{t("common.cancel")}</button>
          <button data-testid="timer-picker-start" onClick={start} disabled={!canStart} style={{ background: canStart ? colors.coral : colors.surface2, color: canStart ? colors.bg : colors.dim, border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700 }}>
            ▶ {t("timer.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
