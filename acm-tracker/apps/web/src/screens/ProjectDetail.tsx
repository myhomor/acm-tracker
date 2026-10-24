import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { Avatar } from "../components/Avatar";
import { DataTable } from "../components/DataTable";
import { Tag } from "../components/Tag";
import { useProject } from "../features/projects/api/use-projects";
import { useTasks, useCreateTask } from "../features/tasks/api/use-tasks";
import { useProjectCost } from "../features/reporting/api/use-reporting";
import { TaskRealCell, TaskCostCell, AddTimeButton, StartTimerButton } from "../features/tasks/components/TaskCostCells";
import { ProjectTimeline } from "../features/time-entries/components/ProjectTimeline";
import { ProjectDocuments } from "../features/documents/components/ProjectDocuments";
import { ProjectTeam } from "../features/reporting/components/ProjectTeam";
import { ProjectMarginPanel } from "../features/reporting/components/ProjectMarginPanel";
import { ProjectEstimatePanel } from "../features/projects/components/ProjectEstimatePanel";
import { colors } from "../theme/tokens";

const TABS = ["resumen", "tareas", "tiempo", "costos", "equipo", "documentos"] as const;
type Tab = (typeof TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  in_progress: colors.blue,
  waiting: colors.amber,
  hold: colors.dim,
  review: colors.amber,
  done: colors.green,
  todo: colors.muted,
};

export function ProjectDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { data: project } = useProject(id);
  const { data: tasks = [] } = useTasks(id);
  const { data: cost } = useProjectCost(id);
  const createTask = useCreateTask(id);
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<Tab>("resumen");
  const showCost = tab === "resumen" || tab === "costos";
  const showTasks = tab === "resumen" || tab === "tareas";

  const add = () => {
    if (!title.trim()) return;
    const code = `T-${String(tasks.length + 1).padStart(3, "0")}`;
    createTask.mutate({ code, title: title.trim() }, { onSuccess: () => setTitle("") });
  };

  const consumed = cost?.total ?? 0;
  const contract = project?.contractAmount ?? 0;
  const pct = contract > 0 ? Math.min(consumed / contract, 1) : 0;

  return (
    <Chrome breadcrumb={t("projects.detail.breadcrumb", { name: project?.name ?? id })}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <Avatar initials={(project?.name ?? "").slice(0, 2).toUpperCase()} index={0} size={56} />
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{project ? project.name : "—"}</h1>
          <div className="mono" style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
            {t("projects.detail.clientMeta", { contract: contract.toLocaleString("en-US") })}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 28, marginBottom: 20 }}>
        {TABS.map((key) => {
          const active = key === tab;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="mono"
              style={{ fontSize: 14, background: "transparent", border: "none", cursor: "pointer", color: active ? colors.coral : colors.muted, borderBottom: active ? `2px solid ${colors.coral}` : "2px solid transparent", paddingBottom: 4 }}
            >
              {t(`projects.tabs.${key}`)}
            </button>
          );
        })}
      </div>

      {showCost && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title={t("projects.detail.costPanelTitle")}>
          <div className="mono" style={{ fontSize: 44, fontWeight: 700 }}>${consumed.toLocaleString("en-US")}</div>
          <div className="mono" style={{ fontSize: 12, color: colors.dim, marginBottom: 12 }}>
            {t("projects.detail.contractCaption", { contract: contract.toLocaleString("en-US"), pct: Math.round(pct * 100) })}
          </div>
          <div style={{ height: 8, background: colors.surface2, borderRadius: 4 }}>
            <div style={{ height: 8, width: `${pct * 100}%`, background: colors.coral, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", gap: 32, marginTop: 20 }}>
            <div>
              <div className="mono" style={{ fontSize: 10, color: colors.muted, letterSpacing: 1 }}>{t("projects.detail.humanLabel")}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>${cost?.human ?? 0}</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 10, color: colors.muted, letterSpacing: 1 }}>{t("projects.detail.aiLabel")}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: colors.blue }}>${cost?.ai ?? 0}</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 10, color: colors.muted, letterSpacing: 1 }}>{t("projects.detail.hoursLabel")}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{cost ? Math.floor(cost.minutes / 60) : 0}h</div>
            </div>
          </div>
        </Panel>
        <ProjectMarginPanel
          human={cost?.human ?? 0}
          minutes={cost?.minutes ?? 0}
          estimateHours={cost?.estimateHours ?? null}
          estimatedCost={cost?.estimatedCost ?? null}
          revenue={cost?.revenue ?? null}
          margin={cost?.margin ?? null}
          marginPerHour={cost?.marginPerHour ?? null}
        />
      </div>
      )}

      {showCost && (
        <div style={{ marginBottom: 16 }}>
          <ProjectEstimatePanel
            projectId={id}
            estimateHours={project?.estimateHours ?? null}
            ratePerHour={project?.ratePerHour ?? null}
          />
        </div>
      )}

      {showTasks && (
      <Panel title={t("projects.detail.tasksPanelTitle", { name: project?.name ?? "" })}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={t("projects.detail.newTaskPlaceholder")}
            aria-label={t("projects.detail.newTaskAriaLabel")}
            style={{ flex: 1, background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "10px 12px" }}
          />
          <button onClick={add} disabled={createTask.isPending} style={{ background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700 }}>
            {t("projects.detail.addTaskButton")}
          </button>
        </div>
        <DataTable
          columns={[
            { key: "code", label: "ID", width: 120 },
            { key: "title", label: t("projects.detail.colTask") },
            { key: "status", label: t("projects.detail.colStatus"), width: 130 },
            { key: "real", label: t("projects.detail.colReal"), width: 100, align: "right" },
            { key: "cost", label: t("projects.detail.colCost"), width: 90, align: "right" },
            { key: "action", label: "", width: 110, align: "right" },
          ]}
          rows={tasks.map((task) => ({
            id: task.id,
            cells: {
              code: <span className="mono" style={{ color: colors.coral }}>{task.code}</span>,
              title: (
                <div>
                  <div>{task.title}</div>
                  {task.summary && <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{task.summary}</div>}
                  {task.phase && <div className="mono" style={{ fontSize: 11, color: colors.dim, marginTop: 2 }}>{task.phase}</div>}
                </div>
              ),
              status: <Tag label={t(`projects.detail.status.${task.status}`, { defaultValue: task.status })} color={STATUS_COLORS[task.status]} />,
              real: <TaskRealCell taskId={task.id} />,
              cost: <TaskCostCell taskId={task.id} />,
              action: <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}><StartTimerButton taskId={task.id} taskCode={task.code} /><AddTimeButton taskId={task.id} projectId={id} /></div>,
            },
          }))}
          emptyLabel={t("projects.detail.emptyTasks")}
        />
      </Panel>
      )}

      {tab === "tiempo" && <ProjectTimeline projectId={id} />}

      {tab === "equipo" && <ProjectTeam projectId={id} />}

      {tab === "documentos" && <ProjectDocuments projectId={id} />}

      <div style={{ marginTop: 12 }}>
        <Link to="/projects" className="mono" style={{ color: colors.muted, fontSize: 13 }}>{t("projects.detail.backLink")}</Link>
      </div>
    </Chrome>
  );
}
