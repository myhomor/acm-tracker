export type WorkKind = "agent" | "wait" | "human";

// Roles of the service members created by the Claude Code tracking hook: the agent and "waiting for reply".
// Waiting is how long a task stood idle, not time spent, so it is kept out of worked-time totals.
export const AGENT_ROLE = "agent";
export const WAIT_ROLE = "system";

export function workKindOfRole(role: string): WorkKind {
  if (role === AGENT_ROLE) return "agent";
  if (role === WAIT_ROLE) return "wait";
  return "human";
}
