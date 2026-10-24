const BASE_URL = ((process.env.ACM_API_URL && process.env.ACM_API_URL.trim()) || "http://localhost:5188").replace(/\/$/, "");
async function request(method, path, body) {
    const res = await fetch(`${BASE_URL}/api${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${method} /api${path} -> ${res.status} ${detail}`.trim());
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
export const apiClient = {
    baseUrl: BASE_URL,
    listProjects: () => request("GET", "/projects"),
    createProject: (input) => request("POST", "/projects", input),
    listTasks: (projectId) => request("GET", `/tasks?projectId=${encodeURIComponent(projectId)}`),
    createTask: (input) => request("POST", "/tasks", input),
    reportWork: (input) => request("POST", "/mcp/report-work", input),
    recentReports: () => request("GET", "/mcp/reports"),
    projectCost: (projectId) => request("GET", `/projects/${encodeURIComponent(projectId)}/cost`),
    todaySummary: () => request("GET", "/reports/today"),
    listModelPrices: () => request("GET", "/model-prices"),
    createModelPrice: (input) => request("POST", "/model-prices", input),
    updateModelPrice: (id, input) => request("PATCH", `/model-prices/${encodeURIComponent(id)}`, input),
};
