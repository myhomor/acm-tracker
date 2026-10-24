#!/usr/bin/env node
// Хук Claude Code → ACM Tracker. Подключается в ~/.claude/settings.json на события сессии,
// считает время агента, ожидания и ручной работы и пишет его в трекер через REST API.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = process.env.ACM_STATE_DIR || join(HOOK_DIR, "state");
const CONFIG_FILE = existsSync(join(HOOK_DIR, "config.json")) ? "config.json" : "config.example.json";
const CONFIG = JSON.parse(readFileSync(join(HOOK_DIR, CONFIG_FILE), "utf8"));
const API = (process.env.ACM_API_URL || CONFIG.apiUrl).replace(/\/$/, "");
const CAP_SEC = CONFIG.manualCapMinutes * 60;
const WAIT_PHASES = new Set(["waiting", "waiting_turn"]);
const IDLE_PHASES = new Set(["waiting", "waiting_turn", "done", "hold"]);
const STATUS_OF = { working: "in_progress", waiting: "waiting", waiting_turn: "waiting", done: "done", hold: "hold" };
const NOTES = { agent: "Claude Code", wait: "ожидание ответа", manual: "вручную · пауза до ответа", explicit: "вручную · #вручную" };

const iso = (ms) => new Date(ms).toISOString();
const secsBetween = (fromIso, toMs) => (fromIso ? Math.max(0, (toMs - Date.parse(fromIso)) / 1000) : 0);
const lower = (s) => String(s).trim().toLowerCase();

class OfflineError extends Error {}

// ---------- команды в сообщении ----------

const END = "(?=$|[\\s.,!?;:])";
const TAGS = {
  notrack: new RegExp(`#(?:notrack|нетрек)${END}`, "iu"),
  track: new RegExp(`#(?:track|трек)${END}`, "iu"),
  hold: new RegExp(`#(?:hold|холд)${END}`, "iu"),
  done: new RegExp(`#(?:done|готово)${END}`, "iu"),
};
const NOTRACK_PHRASE = /не\s+трекай\s+(?:эту\s+задачу|этот\s+диалог|эту\s+сессию)/iu;
const DURATION = "\\d+(?:[.,]\\d+)?\\s*(?:часов|часа|час|ч|h|минуты|минута|минут|мин|м|min|m)?";
const MANUAL = new RegExp(`#(?:вручную|manual)\\s+((?:${DURATION}\\s*)+)`, "iu");

function parseMinutes(text) {
  let total = 0;
  for (const [, num, unit = ""] of text.matchAll(/(\d+(?:[.,]\d+)?)\s*([a-zа-я]*)/giu)) {
    const value = Number(num.replace(",", "."));
    total += /^(ч|час|h)/iu.test(unit) ? value * 60 : value;
  }
  return Math.round(total);
}

function parseCommands(prompt) {
  const manual = prompt.match(MANUAL);
  const cmd = {
    notrack: TAGS.notrack.test(prompt) || NOTRACK_PHRASE.test(prompt),
    track: TAGS.track.test(prompt),
    hold: TAGS.hold.test(prompt),
    done: TAGS.done.test(prompt),
    manualMin: manual ? parseMinutes(manual[1]) : 0,
  };
  let rest = prompt.replace(MANUAL, "").replace(NOTRACK_PHRASE, "");
  for (const re of Object.values(TAGS)) rest = rest.replace(re, "");
  cmd.any = cmd.notrack || cmd.track || cmd.hold || cmd.done || cmd.manualMin > 0;
  cmd.commandOnly = cmd.any && rest.trim() === "";
  return cmd;
}

// ---------- транскрипт ----------

function readJsonl(path) {
  if (!path || !existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* недописанная строка */ }
  }
  return out;
}

function promptText(entry) {
  if (entry.type !== "user" || entry.isMeta || entry.isSidechain) return null;
  const content = entry.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content) && !content.some((c) => c.type === "tool_result")
      ? content.filter((c) => c.type === "text").map((c) => c.text).join("\n")
      : null;
  if (!text || text.startsWith("[Request interrupted")) return null;
  return text;
}

function lastPromptIndex(entries) {
  for (let i = entries.length - 1; i >= 0; i--) if (promptText(entries[i]) !== null) return i;
  return -1;
}

function sessionTitle(entries) {
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i].type === "custom-title" && entries[i].customTitle) return entries[i].customTitle;
  for (const e of entries) {
    const text = promptText(e);
    if (text) return oneLine(text);
  }
  return null;
}

const oneLine = (text) => text.replace(/\s+/g, " ").trim().slice(0, 80);

function firstCwd(entries) {
  return entries.find((e) => e.cwd)?.cwd ?? null;
}

function lastActivityAfter(entries, sinceIso) {
  const since = Date.parse(sinceIso);
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const isWork = e.type === "assistant" || (e.type === "user" && promptText(e) === null);
    if (isWork && Date.parse(e.timestamp) > since) return Date.parse(e.timestamp);
  }
  return null;
}

function firstActivityAfter(entries, sinceIso) {
  const since = Date.parse(sinceIso);
  const hit = entries.find((e) => e.type === "assistant" && Date.parse(e.timestamp) > since);
  return hit ? Date.parse(hit.timestamp) : null;
}

function turnBlocks(entries, sinceIso) {
  const since = sinceIso ? Date.parse(sinceIso) : 0;
  return entries
    .slice(lastPromptIndex(entries) + 1)
    .filter((e) => e.type === "assistant" && Date.parse(e.timestamp) >= since)
    .flatMap((e) => e.message?.content ?? []);
}

const lastWrapUp = (blocks) => blocks.filter((c) => c.type === "tool_use" && c.name === "mcp__ccd_turn__wrap_up").pop()?.input;
const lastText = (blocks) => blocks.filter((c) => c.type === "text").map((c) => c.text).pop() ?? "";

function asksUser(blocks) {
  const wrapUp = lastWrapUp(blocks);
  if (wrapUp) return Boolean(wrapUp.ask);
  return /\?[\s*_)»"'`]*$/u.test(lastText(blocks).trim());
}

function turnSummary(blocks) {
  const source = lastWrapUp(blocks)?.recap ?? lastText(blocks).split(/\n\s*\n/)[0];
  const text = (source ?? "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\s]+/gm, "")
    .replace(/[*`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? (text.length > 400 ? `${text.slice(0, 399)}…` : text) : null;
}

// ---------- токены ----------

function weightedInput(u, model) {
  const cc = u.cache_creation;
  const w5 = cc ? cc.ephemeral_5m_input_tokens ?? 0 : u.cache_creation_input_tokens ?? 0;
  const w1 = cc ? cc.ephemeral_1h_input_tokens ?? 0 : 0;
  const readRatio = CONFIG.cacheReadRatio?.[model] ?? CONFIG.cacheReadRatio?.default ?? 0.1;
  return (u.input_tokens ?? 0) + w5 * 1.25 + w1 * 2 + (u.cache_read_input_tokens ?? 0) * readRatio;
}

function subagentFiles(transcriptPath, sinceMs) {
  const root = join(dirname(transcriptPath), basename(transcriptPath, ".jsonl"), "subagents");
  if (!existsSync(root)) return [];
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.endsWith(".jsonl") && st.mtimeMs > sinceMs) files.push(full);
    }
  };
  walk(root);
  return files;
}

function collectUsage(transcriptPath, entries, cursorIso, nowMs) {
  const since = cursorIso ? Date.parse(cursorIso) : 0;
  const all = [...entries, ...subagentFiles(transcriptPath, since).flatMap(readJsonl)];
  const seen = new Set();
  const byModel = new Map();
  for (const e of all) {
    const usage = e.message?.usage;
    const model = e.message?.model;
    const ts = Date.parse(e.timestamp);
    if (e.type !== "assistant" || !usage || !model || model.startsWith("<") || ts <= since || ts > nowMs) continue;
    const key = e.message.id ?? e.requestId ?? e.uuid;
    if (seen.has(key)) continue;
    seen.add(key);
    const acc = byModel.get(model) ?? { in: 0, out: 0 };
    acc.in += weightedInput(usage, model);
    acc.out += usage.output_tokens ?? 0;
    byModel.set(model, acc);
  }
  return [...byModel].map(([model, t]) => ({ model, agent: "claude-code", tokensIn: Math.round(t.in), tokensOut: Math.round(t.out) }));
}

// ---------- проект и задача ----------

function git(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim();
  } catch {
    return null;
  }
}

function repoRoot(cwd) {
  const common = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (!common) return cwd;
  return basename(common) === ".git" ? dirname(common) : common;
}

function branchOf(cwd) {
  return git(cwd, ["symbolic-ref", "--short", "-q", "HEAD"]) ?? git(cwd, ["rev-parse", "--short", "HEAD"]);
}

function projectFor(root) {
  const match = Object.keys(CONFIG.projectNames ?? {})
    .filter((prefix) => root === prefix || root.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0];
  const client = basename(dirname(root));
  if (!match) return { name: `${client} · ${basename(root)}`, client };
  const override = CONFIG.projectNames[match];
  return typeof override === "string" ? { name: override, client } : { client, ...override };
}

function resolveIdentity(state, input, entries) {
  if (!state.project) {
    state.cwd = firstCwd(entries) ?? input.cwd;
    state.project = projectFor(repoRoot(state.cwd));
  }
  const code = state.task?.code ?? `S-${input.session_id.slice(0, 8)}`;
  const title = sessionTitle(entries) ?? (input.prompt ? oneLine(input.prompt) : null) ?? `Диалог ${code}`;
  const branch = existsSync(state.cwd) ? branchOf(state.cwd) : null;
  const phase = branch ? `ветка: ${branch}` : undefined;
  const prev = state.task;
  state.task = { code, title, phase };
  if (!prev || prev.title !== title || prev.phase !== phase) patchTask(state, { title, ...(phase ? { phase } : {}) });
}

// ---------- состояние сессии ----------

const safeId = (id) => String(id).replace(/[^a-zA-Z0-9-]/g, "_");
const statePath = (sessionId) => join(STATE_DIR, `${safeId(sessionId)}.json`);

function loadState(sessionId) {
  const path = statePath(sessionId);
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  return { sessionId, phase: "idle", since: null, untracked: false, afterTurn: null, gapExplicitSec: 0,
    carry: { agent: 0, wait: 0, manual: 0 }, agentSec: 0, usageCursor: null, project: null, task: null, status: null };
}

// Ответвление диалога (fork, правка старого сообщения) приходит новой сессией с копией истории.
// Родителя узнаём по общим id сообщений среди уже трекаемых сессий той же папки.
function findForkParent(input) {
  const own = new Set(readJsonl(input.transcript_path).map((e) => e.uuid).filter(Boolean));
  if (own.size === 0) return null;
  let best = null;
  for (const name of readdirSync(STATE_DIR)) {
    const sessionId = name.endsWith(".json") && name !== "ids.json" ? name.slice(0, -5) : null;
    if (!sessionId || sessionId === safeId(input.session_id)) continue;
    const shared = readJsonl(join(dirname(input.transcript_path), `${sessionId}.jsonl`)).filter((e) => e.uuid && own.has(e.uuid));
    const lastTs = shared.length ? shared[shared.length - 1].timestamp : null;
    if (lastTs && (!best || lastTs > best.lastTs)) best = { sessionId, lastTs };
  }
  return best;
}

function inheritFromParent(sessionId, fork, nowMs) {
  const parent = loadState(fork.sessionId);
  const idle = IDLE_PHASES.has(parent.phase) && parent.since;
  return {
    ...loadState(sessionId),
    project: parent.project,
    task: parent.task,
    cwd: parent.cwd,
    status: parent.status,
    summary: parent.summary,
    untracked: parent.untracked,
    forkOf: parent.sessionId,
    usageCursor: fork.lastTs,
    phase: idle ? parent.phase : "done",
    since: idle ? parent.since : iso(nowMs),
  };
}

const CLAIMS_PATH = () => join(STATE_DIR, "human-claims.json");
const CLAIMS_KEEP_MS = 48 * 3600 * 1000;

async function withHumanClaims(state, nowMs, run) {
  const result = await withLock("human", async () => {
    const all = existsSync(CLAIMS_PATH()) ? JSON.parse(readFileSync(CLAIMS_PATH(), "utf8")) : [];
    state.claims = all.filter(([, end]) => end > nowMs - CLAIMS_KEEP_MS);
    const out = run();
    writeFileSync(CLAIMS_PATH(), JSON.stringify(state.claims));
    return { out };
  });
  if (result) return result.out;
  state.claims = null;
  return run();
}

async function releaseParentGap(parentId, nowMs) {
  await withLock(parentId, async () => {
    const parent = loadState(parentId);
    if (IDLE_PHASES.has(parent.phase)) saveState({ ...parent, since: iso(nowMs) });
  });
}

function saveState(state) {
  const { outbox, pendingTask, timerActive, claims, ...persist } = state;
  writeFileSync(statePath(state.sessionId), JSON.stringify(persist, null, 2));
}

function patchTask(state, fields) {
  state.pendingTask = { ...state.pendingTask, ...fields };
}

function setPhase(state, phase, nowMs) {
  state.phase = phase;
  state.since = iso(nowMs);
  const status = STATUS_OF[phase];
  if (status && state.status !== status) {
    state.status = status;
    patchTask(state, { status });
  }
}

function addTime(state, kind, seconds, startedAt) {
  state.carry[kind] += seconds;
  const minutes = Math.floor(state.carry[kind] / 60);
  state.carry[kind] -= minutes * 60;
  if (minutes > 0) state.outbox.push({ kind, minutes, startedAt, note: NOTES[kind] });
}

// Человек один на все диалоги: отрезок ручного времени, уже засчитанный в одном диалоге,
// не засчитывается в другом. Занятые отрезки хранятся в state/human-claims.json.
function freeIntervals([start, end], claims) {
  const free = [];
  let cursor = start;
  for (const [s, e] of [...claims].sort((a, b) => a[0] - b[0])) {
    if (e <= cursor) continue;
    if (s >= end) break;
    if (s > cursor) free.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < end) free.push([cursor, end]);
  return free;
}

function claimHumanTime(state, startMs, endMs) {
  if (endMs <= startMs) return 0;
  if (!state.claims) return (endMs - startMs) / 1000;
  const free = freeIntervals([startMs, endMs], state.claims);
  state.claims.push(...free);
  return free.reduce((sum, [a, b]) => sum + (b - a), 0) / 1000;
}

function closeGap(state, nowMs) {
  if (!IDLE_PHASES.has(state.phase) || !state.since) return;
  const gap = secsBetween(state.since, nowMs);
  const counted = state.phase !== "hold";
  const explicit = Math.min(state.gapExplicitSec, gap);
  const startMs = Date.parse(state.since);
  const manual = counted && explicit === 0 && !state.timerActive
    ? claimHumanTime(state, startMs, Math.min(nowMs, startMs + CAP_SEC * 1000))
    : 0;
  if (manual > 0) addTime(state, "manual", manual, state.since);
  if (WAIT_PHASES.has(state.phase)) addTime(state, "wait", Math.max(0, gap - manual - explicit), state.since);
  state.gapExplicitSec = 0;
}

function closeAgentTurn(state, entries, nowMs, transcriptPath, summary) {
  const usage = collectUsage(transcriptPath, entries, state.usageCursor, nowMs);
  state.usageCursor = iso(nowMs);
  const total = state.carry.agent + state.agentSec;
  const minutes = Math.floor(total / 60);
  state.carry.agent = total - minutes * 60;
  state.agentSec = 0;
  if (minutes > 0 || usage.length > 0) state.outbox.push({ kind: "agent", minutes, aiRuns: usage, note: summary ?? NOTES.agent });
  if (summary && summary !== state.summary) {
    state.summary = summary;
    patchTask(state, { summary });
  }
}

// ---------- обработчики событий ----------

function block(reason) {
  return { decision: "block", reason: `ACM-трекер: ${reason}` };
}

const BACKGROUND_EVENT = /^\s*<task-notification>/;

function onPrompt(input, state, nowMs) {
  if (BACKGROUND_EVENT.test(input.prompt ?? "")) return onBackgroundResume(input, state, nowMs);
  const cmd = parseCommands(input.prompt ?? "");
  if (state.untracked && !cmd.track) return null;
  const notes = [];
  if (cmd.track && state.untracked) {
    state.untracked = false;
    notes.push("трекинг снова включён");
  }
  if (cmd.notrack) return stopTracking(state, cmd);
  const entries = readJsonl(input.transcript_path);
  resolveIdentity(state, input, entries);
  if (state.usageCursor === null) state.usageCursor = iso(nowMs);
  if (cmd.manualMin > 0) {
    state.outbox.push({ kind: "manual", minutes: cmd.manualMin, startedAt: iso(nowMs - cmd.manualMin * 60000), note: NOTES.explicit });
    state.gapExplicitSec += cmd.manualMin * 60;
    claimHumanTime(state, nowMs - cmd.manualMin * 60000, nowMs);
    notes.push(`+${cmd.manualMin} мин ручной работы`);
  }
  if (cmd.commandOnly) return block(applyStatusCommand(state, cmd, nowMs, notes).join(", ") || "команда принята");
  closeInterruptedTurn(state, entries, nowMs);
  closeGap(state, nowMs);
  setPhase(state, "working", nowMs);
  state.afterTurn = cmd.hold ? "hold" : cmd.done ? "done" : null;
  return notes.length ? { systemMessage: `ACM-трекер: ${notes.join(", ")}` } : null;
}

// Ход, запущенный уведомлением о фоновой задаче, а не тобой: пауза перед ним —
// это агент ждал свою сборку или тест, ручной работы в ней нет.
function onBackgroundResume(input, state, nowMs) {
  if (state.untracked || state.phase === "working") return null;
  resolveIdentity(state, input, readJsonl(input.transcript_path));
  if (state.usageCursor === null) state.usageCursor = iso(nowMs);
  const gap = secsBetween(state.since, nowMs);
  if (state.phase === "done") state.agentSec += gap;
  else if (WAIT_PHASES.has(state.phase)) addTime(state, "wait", gap, state.since);
  state.gapExplicitSec = 0;
  setPhase(state, "working", nowMs);
  return null;
}

function stopTracking(state, cmd) {
  state.untracked = true;
  if (state.task) patchTask(state, { status: "done" });
  state.status = "done";
  const reason = "этот диалог больше не трекается (вернуть: #трек)";
  return cmd.commandOnly ? block(reason) : { systemMessage: `ACM-трекер: ${reason}` };
}

function applyStatusCommand(state, cmd, nowMs, notes) {
  const target = cmd.hold ? "hold" : cmd.done ? "done" : null;
  if (!target) return notes;
  if (state.phase === "working" || state.phase === "waiting_turn") {
    state.afterTurn = target;
  } else {
    closeGap(state, nowMs);
    setPhase(state, target, nowMs);
  }
  notes.push(target === "hold" ? "задача на холде" : "задача закрыта");
  return notes;
}

function closeInterruptedTurn(state, entries, nowMs) {
  if (state.phase !== "working") return;
  const end = lastActivityAfter(entries, state.since) ?? Date.parse(state.since);
  state.agentSec += secsBetween(state.since, end);
  state.phase = "done";
  state.since = iso(end);
}

function onWaitStart(input, state, nowMs) {
  if (state.untracked || state.phase !== "working") return null;
  state.agentSec += secsBetween(state.since, nowMs);
  setPhase(state, "waiting_turn", nowMs);
  return null;
}

function onToolDone(input, state, nowMs) {
  if (state.untracked || !IDLE_PHASES.has(state.phase)) return null;
  if (state.phase === "waiting_turn") closeGap(state, nowMs);
  setPhase(state, "working", nowMs);
  return null;
}

function onStop(input, state, nowMs) {
  if (state.untracked) return null;
  const entries = readJsonl(input.transcript_path);
  if (state.phase === "idle") adoptRunningTurn(state, entries, nowMs);
  resolveIdentity(state, input, entries);
  const blocks = turnBlocks(entries, state.phase === "waiting_turn" ? null : state.since);
  if (state.phase === "working") state.agentSec += secsBetween(state.since, nowMs);
  else if (state.phase === "waiting_turn") closeGap(state, nowMs);
  else state.agentSec += (nowMs - (firstActivityAfter(entries, state.since) ?? nowMs)) / 1000;
  closeAgentTurn(state, entries, nowMs, input.transcript_path, turnSummary(blocks));
  setPhase(state, state.afterTurn ?? (asksUser(blocks) ? "waiting" : "done"), nowMs);
  state.afterTurn = null;
  return null;
}

function adoptRunningTurn(state, entries, nowMs) {
  const idx = lastPromptIndex(entries);
  const start = idx >= 0 ? Date.parse(entries[idx].timestamp) : nowMs;
  state.phase = "working";
  state.since = iso(start);
  state.usageCursor = iso(start - 1);
}

function onSessionEnd(input, state, nowMs) {
  return state.phase === "working" ? onStop(input, state, nowMs) : null;
}

const HANDLERS = {
  UserPromptSubmit: onPrompt,
  PreToolUse: onWaitStart,
  PermissionRequest: onWaitStart,
  PostToolUse: onToolDone,
  PostToolUseFailure: onToolDone,
  PermissionDenied: onToolDone,
  Stop: onStop,
  SessionEnd: onSessionEnd,
};

function isNoop(input) {
  const path = statePath(input.session_id);
  if (!existsSync(path)) return input.hook_event_name !== "UserPromptSubmit" && input.hook_event_name !== "Stop";
  const { phase, untracked } = JSON.parse(readFileSync(path, "utf8"));
  if (untracked && input.hook_event_name !== "UserPromptSubmit") return true;
  if (["PostToolUse", "PostToolUseFailure", "PermissionDenied"].includes(input.hook_event_name)) return !IDLE_PHASES.has(phase);
  if (["PreToolUse", "PermissionRequest"].includes(input.hook_event_name)) return phase !== "working";
  return false;
}

// ---------- API трекера ----------

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    throw new OfflineError(`${method} ${path}: ${e.message}`);
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text().catch(() => "")}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function isTimerActive() {
  try {
    return Boolean(await api("GET", "/timer/active"));
  } catch {
    return false;
  }
}

const IDS_PATH = () => join(STATE_DIR, "ids.json");
const loadIds = () => (existsSync(IDS_PATH()) ? JSON.parse(readFileSync(IDS_PATH(), "utf8")) : { projects: {}, tasks: {}, members: {} });
const saveIds = (ids) => writeFileSync(IDS_PATH(), JSON.stringify(ids, null, 2));

async function ensureProject(ids, project) {
  const key = lower(project.name);
  if (ids.projects[key]) return ids.projects[key];
  const found = (await api("GET", "/projects")).find((p) => lower(p.name) === key);
  const created = found ?? (await api("POST", "/projects", { name: project.name, client: project.client }));
  ids.projects[key] = created.id;
  return created.id;
}

async function ensureTask(ids, projectId, task) {
  const key = `${projectId}|${lower(task.code)}`;
  if (ids.tasks[key]) return ids.tasks[key];
  const found = (await api("GET", `/tasks?projectId=${encodeURIComponent(projectId)}`)).find((t) => lower(t.code) === lower(task.code));
  const created = found ?? (await api("POST", "/tasks", { projectId, code: task.code, title: task.title, ...(task.phase ? { phase: task.phase } : {}) }));
  ids.tasks[key] = created.id;
  return created.id;
}

async function ensureMember(ids, member, role) {
  const key = lower(member.email);
  if (ids.members[key]) return;
  const found = (await api("GET", "/members")).find((m) => lower(m.email) === key);
  if (!found) await api("POST", "/members", { name: member.name, email: member.email, role, ratePerHour: member.ratePerHour });
  ids.members[key] = true;
}

async function applyRecord(rec) {
  const ids = loadIds();
  try {
    const taskId = await ensureTask(ids, await ensureProject(ids, rec.project), rec.task);
    if (rec.kind === "task") return await api("PATCH", `/tasks/${taskId}`, rec.fields);
    if (rec.kind === "manual") return await api("POST", "/time-entries", { taskId, minutes: rec.minutes, billable: true, note: rec.note, startedAt: rec.startedAt });
    const member = rec.kind === "agent" ? CONFIG.agentMember : CONFIG.waitMember;
    await ensureMember(ids, member, rec.kind === "agent" ? "agent" : "system");
    return await api("POST", "/mcp/report-work", { taskId, memberEmail: member.email, minutes: rec.minutes, output: rec.note, aiRuns: rec.aiRuns ?? [] });
  } finally {
    saveIds(ids);
  }
}

async function deliver(rec) {
  try {
    await applyRecord(rec);
  } catch (e) {
    if (e instanceof OfflineError) throw e;
    saveIds({ projects: {}, tasks: {}, members: {} });
    await applyRecord(rec).catch((e2) => {
      if (e2 instanceof OfflineError) throw e2;
      log(`drop ${rec.kind}: ${e2.message}`);
    });
  }
}

const QUEUE_PATH = () => join(STATE_DIR, "queue.jsonl");

function enqueue(records) {
  if (records.length) appendFileSync(QUEUE_PATH(), records.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

async function deliverAll(records) {
  for (let i = 0; i < records.length; i++) {
    try {
      await deliver(records[i]);
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      enqueue(records.slice(i));
      return false;
    }
  }
  return true;
}

async function flushQueue() {
  await withLock("queue", async () => {
    if (!existsSync(QUEUE_PATH())) return;
    const records = readJsonl(QUEUE_PATH());
    rmSync(QUEUE_PATH());
    await deliverAll(records);
  }, { wait: false });
}

// ---------- инфраструктура ----------

function log(message) {
  try { appendFileSync(join(STATE_DIR, "hook.log"), `${new Date().toISOString()} ${message}\n`); } catch { /* лог не важнее сессии */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withLock(name, fn, { wait = true } = {}) {
  const dir = join(STATE_DIR, `${safeId(name)}.lock`);
  const deadline = Date.now() + 3000;
  for (;;) {
    try {
      mkdirSync(dir);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      if (Date.now() - statSync(dir).mtimeMs > 15000) { rmSync(dir, { recursive: true, force: true }); continue; }
      if (!wait || Date.now() > deadline) return undefined;
      await sleep(50);
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

function recordsFor(state) {
  const identity = { project: state.project, task: state.task };
  const records = state.outbox.map((r) => ({ ...identity, ...r }));
  if (state.pendingTask && state.task) records.unshift({ ...identity, kind: "task", fields: state.pendingTask });
  return state.project && state.task ? records : [];
}

async function main() {
  const input = JSON.parse(await readStdin());
  if (!CONFIG.enabled || process.env.ACM_TRACK === "0" || !input.session_id) return;
  const handler = HANDLERS[input.hook_event_name];
  if (!handler) return;
  mkdirSync(STATE_DIR, { recursive: true });
  if (isNoop(input)) return;
  const nowMs = Number(process.env.ACM_NOW) || Date.now();
  const output = await withLock(input.session_id, async () => {
    await flushQueue();
    const fresh = !existsSync(statePath(input.session_id));
    const fork = fresh ? findForkParent(input) : null;
    const base = fork ? inheritFromParent(input.session_id, fork, nowMs) : loadState(input.session_id);
    const state = { ...base, outbox: [], pendingTask: null, timerActive: await isTimerActive(), claims: null };
    const out = await withHumanClaims(state, nowMs, () => handler(input, state, nowMs));
    saveState(state);
    if (state.forkOf) await releaseParentGap(state.forkOf, nowMs);
    await deliverAll(recordsFor(state));
    return out;
  });
  if (output) process.stdout.write(JSON.stringify(output));
}

main()
  .catch((e) => log(`error: ${e.stack ?? e}`))
  .finally(() => process.exit(0));
