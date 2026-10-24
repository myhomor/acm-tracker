import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cabina } from "./screens/Cabina";
import { Projects } from "./screens/Projects";
import { ProjectDetail } from "./screens/ProjectDetail";
import { Costs } from "./screens/Costs";
import { Reports } from "./screens/Reports";
import { Tracker } from "./screens/Tracker";
import { Documents } from "./screens/Documents";
import { Notifications } from "./screens/Notifications";
import { Mcp } from "./screens/Mcp";
import { Auth } from "./screens/Auth";
import { Settings } from "./screens/Settings";
import { CommandPalette } from "./components/CommandPalette";
import { useCommandPalette } from "./features/command-palette/use-command-palette";
import { TimeEntryModal } from "./features/time-entries/components/TimeEntryModal";
import { TimerStartModal } from "./features/timer/components/TimerStartModal";
import { GlobalTimerDock } from "./features/timer/components/GlobalTimerDock";

function GlobalCommandPalette() {
  const navigate = useNavigate();
  const { open, setOpen } = useCommandPalette();
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useCommandPalette.getState().open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const go = (path: string) => navigate(path);
  return (
    <CommandPalette
      open={open}
      onClose={() => setOpen(false)}
      commands={[
        { icon: "◆", label: t("palette.cabina"), hint: "C", onRun: () => go("/") },
        { icon: "⊞", label: t("palette.projects"), hint: "P", onRun: () => go("/projects") },
        { icon: "$", label: t("palette.costs"), onRun: () => go("/costs") },
        { icon: "▤", label: t("palette.reports"), onRun: () => go("/reports") },
        { icon: "◷", label: t("palette.tracker"), onRun: () => go("/tracker") },
        { icon: "⎙", label: t("palette.documents"), onRun: () => go("/documents") },
        { icon: "◇", label: t("palette.mcp"), onRun: () => go("/mcp") },
        { icon: "✎", label: t("palette.settings"), onRun: () => go("/settings") },
      ]}
    />
  );
}

export default function App() {
  return (
    <>
      <GlobalCommandPalette />
      <TimeEntryModal />
      <TimerStartModal />
      <Routes>
        <Route path="/" element={<Cabina />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/costs" element={<Costs />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/mcp" element={<Mcp />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <GlobalTimerDock />
    </>
  );
}
