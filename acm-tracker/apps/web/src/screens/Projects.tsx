import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { useCreateProject, useProjects } from "../features/projects/api/use-projects";
import { colors } from "../theme/tokens";

export function Projects() {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const [name, setName] = useState("");

  const create = () => {
    if (!name.trim()) return;
    createProject.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
  };

  return (
    <Chrome breadcrumb={t("projects.breadcrumb")}>
      <Panel title={t("projects.panelTitle")}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder={t("projects.newProjectPlaceholder")}
            aria-label={t("projects.newProjectAriaLabel")}
            style={{ flex: 1, background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "10px 12px" }}
          />
          <button
            onClick={create}
            disabled={createProject.isPending}
            style={{ background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700 }}
          >
            {t("projects.createButton")}
          </button>
        </div>
        {projects.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${colors.border}`, textDecoration: "none", color: colors.text }}
          >
            <span>
              {p.name} <span className="mono" style={{ color: colors.dim, fontSize: 12 }}>{p.client ?? ""}</span>
            </span>
            <span className="mono" style={{ color: colors.muted }}>
              {p.contractAmount ? `$${p.contractAmount.toLocaleString()}` : "—"}
            </span>
          </Link>
        ))}
      </Panel>
    </Chrome>
  );
}
