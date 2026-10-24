import { apiClient } from "./api-client.js";
function matchesName(project, name) {
    return project.name.trim().toLowerCase() === name.trim().toLowerCase();
}
function matchesCode(task, code) {
    return task.code.trim().toLowerCase() === code.trim().toLowerCase();
}
export async function resolveProject(name, createIfMissing) {
    const projects = await apiClient.listProjects();
    const existing = projects.find((p) => matchesName(p, name));
    if (existing)
        return existing;
    if (!createIfMissing)
        throw new Error(`Project "${name}" not found. Pass createMissing=true to create it.`);
    return apiClient.createProject({ name });
}
export async function resolveTask(projectId, code, title, createIfMissing) {
    const tasks = await apiClient.listTasks(projectId);
    const existing = tasks.find((t) => matchesCode(t, code));
    if (existing)
        return existing;
    if (!createIfMissing)
        throw new Error(`Task "${code}" not found in project. Pass createMissing=true to create it.`);
    return apiClient.createTask({ projectId, code, title: title ?? code });
}
export async function resolveTaskId(args) {
    if (args.taskId)
        return args.taskId;
    if (!args.projectName || !args.taskCode) {
        throw new Error("Provide either taskId, or both projectName and taskCode.");
    }
    const project = await resolveProject(args.projectName, args.createMissing);
    const task = await resolveTask(project.id, args.taskCode, args.taskTitle, args.createMissing);
    return task.id;
}
