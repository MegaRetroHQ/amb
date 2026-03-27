import type { ToolArgs } from "../types/tool-args";

type AgentLike = {
  id?: string;
  name?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ThreadLike = {
  id?: string;
  title?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MessageLike = {
  id?: string;
  threadId?: string;
  fromAgentId?: string | null;
  toAgentId?: string | null;
  payload?: unknown;
  status?: string;
  retryCount?: number;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type TaskLike = {
  id?: string;
  key?: string;
  title?: string;
  state?: string;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  updatedAt?: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function previewPayload(payload: unknown): string | null {
  if (payload == null) return null;
  if (typeof payload === "string") return payload.slice(0, 160);

  const record = asRecord(payload);
  if (!record) return JSON.stringify(payload).slice(0, 160);

  for (const key of ["text", "task", "message", "summary", "title", "content"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.slice(0, 160);
    }
  }

  return JSON.stringify(record).slice(0, 160);
}

export function getLimit(args: ToolArgs): number {
  const raw = args.limit;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(raw)));
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
    }
  }
  return DEFAULT_LIMIT;
}

export function isSummaryMode(args: ToolArgs, defaultValue = true): boolean {
  const raw = args.summary;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    if (raw === "true") return true;
    if (raw === "false") return false;
  }
  return defaultValue;
}

export function shapeAgents(agents: AgentLike[], args: ToolArgs) {
  const limited = agents.slice(0, getLimit(args));
  if (!isSummaryMode(args)) return limited;

  return limited.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    status: agent.status,
    updatedAt: agent.updatedAt ?? agent.createdAt,
  }));
}

export function shapeThreads(threads: ThreadLike[], args: ToolArgs) {
  const limited = threads.slice(0, getLimit(args));
  if (!isSummaryMode(args)) return limited;

  return limited.map((thread) => ({
    id: thread.id,
    title: thread.title,
    status: thread.status,
    updatedAt: thread.updatedAt ?? thread.createdAt,
  }));
}

export function shapeMessages(messages: MessageLike[], args: ToolArgs) {
  const limited = messages.slice(0, getLimit(args));
  if (!isSummaryMode(args)) return limited;

  return limited.map((message) => ({
    id: message.id,
    threadId: message.threadId,
    fromAgentId: message.fromAgentId,
    toAgentId: message.toAgentId,
    status: message.status,
    retryCount: message.retryCount,
    parentId: message.parentId,
    preview: previewPayload(message.payload),
    createdAt: message.createdAt,
  }));
}

export function shapeTasks(tasks: TaskLike[], args: ToolArgs) {
  const limited = tasks.slice(0, getLimit(args));
  if (!isSummaryMode(args)) return limited;

  return limited.map((task) => ({
    id: task.id,
    key: task.key,
    title: task.title,
    state: task.state,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
    updatedAt: task.updatedAt,
  }));
}
