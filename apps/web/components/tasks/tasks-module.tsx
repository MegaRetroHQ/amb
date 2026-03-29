"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react";

import { Badge } from "@amb-app/ui/components/badge";
import { Button } from "@amb-app/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@amb-app/ui/components/dialog";
import { Input } from "@amb-app/ui/components/input";
import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { MarkdownContent } from "@amb-app/ui/components/markdown-content";
import { DescriptionEditor } from "@/components/ui/description-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@amb-app/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@amb-app/ui/components/table";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATES,
  TASK_STATE_LABELS,
  taskSearchToApiQuery,
} from "@/lib/tasks";
import { useTasks, type TaskFilters } from "@/lib/hooks/use-tasks";
import { useEpics, type EpicListItem } from "@/lib/hooks/use-epics";
import { useSprints } from "@/lib/hooks/use-sprints";
import { useProjectMembers } from "@/lib/hooks/use-project-members";
import { EpicBadge } from "@/components/tasks/epic-badge";
import { EpicPicker } from "@/components/tasks/epic-picker";
import { SprintBadge } from "@/components/tasks/sprint-badge";
import { SprintPicker } from "@/components/tasks/sprint-picker";
import {
  TasksWorkspaceFilterDeck,
} from "@/components/tasks/tasks-workspace-shell";
import type { Task, TaskPriority, TaskState } from "@/lib/types";
import { getLocalizedApiErrorMessage } from "@/lib/api/error-i18n";
import { cn } from "@amb-app/ui/lib/utils";

type TasksModuleProps = {
  projectId: string;
};

type ViewMode = "list" | "kanban";

type TaskFormState = {
  title: string;
  description: string;
  state: TaskState;
  priority: TaskPriority;
  assigneeId: string;
  epicId: string;
  sprintId: string;
  dueDate: string;
};

const defaultTaskForm: TaskFormState = {
  title: "",
  description: "",
  state: "BACKLOG",
  priority: "NONE",
  assigneeId: "",
  epicId: "",
  sprintId: "",
  dueDate: "",
};

const UNASSIGNED_SELECT_VALUE = "__unassigned__";

const priorityRank: Record<TaskPriority, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

const TASK_STATE_ORDER: Record<TaskState, number> = {
  BACKLOG: 0,
  TODO: 1,
  IN_PROGRESS: 2,
  DONE: 3,
};

type TaskListSortColumn =
  | "key"
  | "title"
  | "state"
  | "priority"
  | "epic"
  | "sprint"
  | "assignee"
  | "dueDate";

type TaskListSort = { column: TaskListSortColumn; direction: "asc" | "desc" };

/** Default: due date ascending (soonest first; tasks without due date last). */
const defaultTaskListSort: TaskListSort = { column: "dueDate", direction: "asc" };

function defaultSortDirection(column: TaskListSortColumn): "asc" | "desc" {
  if (column === "priority") {
    return "desc";
  }
  return "asc";
}

function compareTasksBySort(a: Task, b: Task, sort: TaskListSort): number {
  const asc = sort.direction === "asc" ? 1 : -1;

  switch (sort.column) {
    case "key": {
      const ka = a.key ?? "";
      const kb = b.key ?? "";
      if (!ka && !kb) return 0;
      if (!ka) return 1;
      if (!kb) return -1;
      return ka.localeCompare(kb, undefined, { numeric: true, sensitivity: "base" }) * asc;
    }
    case "title":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) * asc;
    case "state":
      return (TASK_STATE_ORDER[a.state] - TASK_STATE_ORDER[b.state]) * asc;
    case "priority":
      return (priorityRank[a.priority] - priorityRank[b.priority]) * asc;
    case "epic": {
      const ea = a.epic?.title;
      const eb = b.epic?.title;
      if (!ea && !eb) return 0;
      if (!ea) return 1;
      if (!eb) return -1;
      return ea.localeCompare(eb, undefined, { sensitivity: "base" }) * asc;
    }
    case "sprint": {
      const sa = a.sprint?.name;
      const sb = b.sprint?.name;
      if (!sa && !sb) return 0;
      if (!sa) return 1;
      if (!sb) return -1;
      return sa.localeCompare(sb, undefined, { sensitivity: "base" }) * asc;
    }
    case "assignee": {
      const aa = a.assignee?.name;
      const ab = b.assignee?.name;
      if (!aa && !ab) return 0;
      if (!aa) return 1;
      if (!ab) return -1;
      return aa.localeCompare(ab, undefined, { sensitivity: "base" }) * asc;
    }
    case "dueDate": {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      const aT = new Date(a.dueDate).getTime();
      const bT = new Date(b.dueDate).getTime();
      return (aT - bT) * asc;
    }
    default:
      return 0;
  }
}

function SortableTh({
  column,
  label,
  sort,
  onSort,
  toggleSortLabel,
  className,
}: {
  column: TaskListSortColumn;
  label: string;
  sort: TaskListSort;
  onSort: (c: TaskListSortColumn) => void;
  toggleSortLabel: string;
  className?: string;
}) {
  const active = sort.column === column;
  const ariaSort =
    active && sort.direction === "asc"
      ? "ascending"
      : active && sort.direction === "desc"
        ? "descending"
        : "none";

  return (
    <TableHead className={cn("px-3", className)} aria-sort={ariaSort}>
      <button
        type="button"
        className={cn(
          "group inline-flex min-h-9 w-full max-w-full items-center gap-1.5 rounded-md px-1 py-1 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-muted/60 hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        onClick={() => onSort(column)}
        aria-label={`${label}. ${toggleSortLabel}`}
      >
        <span className="select-none">{label}</span>
        <span className="inline-flex size-4 shrink-0 items-center justify-center">
          {active ? (
            sort.direction === "asc" ? (
              <ArrowUp className="size-3.5 opacity-90" aria-hidden />
            ) : (
              <ArrowDown className="size-3.5 opacity-90" aria-hidden />
            )
          ) : (
            <ArrowUpDown className="size-3.5 opacity-35 group-hover:opacity-60" aria-hidden />
          )}
        </span>
      </button>
    </TableHead>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function assigneeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    const w = parts[0];
    return w ? w.slice(0, 2).toUpperCase() : "?";
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  const pair = `${first}${last}`.toUpperCase();
  return pair || "?";
}

function toFormState(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description ?? "",
    state: task.state,
    priority: task.priority,
    assigneeId: task.assigneeId ?? "",
    epicId: task.epicId ?? "",
    sprintId: task.sprintId ?? "",
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
  };
}

export function TasksModule({ projectId }: TasksModuleProps) {
  const t = useTranslations("Tasks");
  const tEpic = useTranslations("Epics");
  const tSprints = useTranslations("Sprints");
  const tCommon = useTranslations("Common");
  const searchParams = useSearchParams();
  const urlKey = searchParams.get("key");
  const urlSearchParam = searchParams.get("search");
  const urlEpicId = searchParams.get("epicId");
  const urlSprintId = searchParams.get("sprintId");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [listSort, setListSort] = useState<TaskListSort>(defaultTaskListSort);

  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("key") ?? searchParams.get("search") ?? "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get("key") ?? searchParams.get("search") ?? "",
  );

  const [filters, setFilters] = useState<TaskFilters>({
    state: "ALL",
    priority: "ALL",
    assigneeId: "ALL",
    epicId: "ALL",
    sprintId: "ALL",
    dueFrom: "",
    dueTo: "",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewDescriptionTask, setViewDescriptionTask] = useState<Task | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(defaultTaskForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [copiedTaskKeyId, setCopiedTaskKeyId] = useState<string | null>(null);
  const kanbanColRefs = useRef<Partial<Record<TaskState, HTMLDivElement | null>>>({});
  const [kanbanMobileColumn, setKanbanMobileColumn] = useState<TaskState>(
    () => TASK_STATES[0] ?? "BACKLOG",
  );

  const { tasks, loading, error, createTask, updateTask, deleteTask } = useTasks(projectId, filters);
  const { members, loading: membersLoading } = useProjectMembers(projectId);
  const { epics: activeEpics, loading: epicsLoading } = useEpics(projectId, "ALL");
  const { sprints: allSprints, loading: sprintsLoading } = useSprints(projectId, "ALL");

  useEffect(() => {
    const fromUrl = urlKey ?? urlSearchParam ?? "";
    setSearchInput(fromUrl);
    setDebouncedSearch(fromUrl);
  }, [projectId, urlKey, urlSearchParam]);

  useEffect(() => {
    if (!urlEpicId) {
      return;
    }
    setFilters((prev) => ({ ...prev, epicId: urlEpicId }));
  }, [projectId, urlEpicId]);

  useEffect(() => {
    if (!urlSprintId) {
      return;
    }
    setFilters((prev) => ({ ...prev, sprintId: urlSprintId }));
  }, [projectId, urlSprintId]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    const q = taskSearchToApiQuery(debouncedSearch);
    setFilters((prev) => {
      const next: TaskFilters = { ...prev };
      delete next.key;
      delete next.search;
      if (q.key) {
        next.key = q.key;
      } else if (q.search) {
        next.search = q.search;
      }
      return next;
    });
  }, [debouncedSearch]);

  useEffect(() => {
    const key = `tasks:view:${projectId}`;
    const stored = window.localStorage.getItem(key);
    if (stored === "list" || stored === "kanban") {
      setViewMode(stored);
    }
  }, [projectId]);

  const setAndStoreViewMode = (value: ViewMode) => {
    setViewMode(value);
    window.localStorage.setItem(`tasks:view:${projectId}`, value);
  };

  const sortedTasks = useMemo(() => {
    const items = [...tasks];
    items.sort((a, b) => {
      const primary = compareTasksBySort(a, b, listSort);
      if (primary !== 0) return primary;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return items;
  }, [tasks, listSort]);

  const toggleListSort = (column: TaskListSortColumn) => {
    setListSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: defaultSortDirection(column) },
    );
  };

  const openCreateDialog = () => {
    setForm(defaultTaskForm);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setForm(toFormState(task));
    setFormError(null);
  };

  const closeDialogs = () => {
    setCreateOpen(false);
    setEditingTask(null);
    setForm(defaultTaskForm);
    setFormError(null);
  };

  const submitCreate = async () => {
    if (!form.title.trim()) {
      setFormError(t("titleRequired"));
      return;
    }

    try {
      setSubmitting(true);
      await createTask({
        title: form.title,
        description: form.description || null,
        state: form.state,
        priority: form.priority,
        assigneeId: form.assigneeId || null,
        epicId: form.epicId || null,
        sprintId: form.sprintId || null,
        dueDate: form.dueDate || null,
      });
      closeDialogs();
    } catch (submitError) {
      setFormError(getLocalizedApiErrorMessage(submitError, tCommon));
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!editingTask) {
      return;
    }

    if (!form.title.trim()) {
      setFormError(t("titleRequired"));
      return;
    }

    try {
      setSubmitting(true);
      await updateTask(editingTask.id, {
        title: form.title,
        description: form.description || null,
        state: form.state,
        priority: form.priority,
        assigneeId: form.assigneeId || null,
        epicId: form.epicId || null,
        sprintId: form.sprintId || null,
        dueDate: form.dueDate || null,
      });
      closeDialogs();
    } catch (submitError) {
      setFormError(getLocalizedApiErrorMessage(submitError, tCommon));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTaskId) {
      return;
    }

    try {
      await deleteTask(deleteTaskId);
      setDeleteTaskId(null);
    } catch (deleteError) {
      setFormError(getLocalizedApiErrorMessage(deleteError, tCommon));
    }
  };

  const onDropToState = async (state: TaskState) => {
    if (!dragTaskId) {
      return;
    }

    const draggedTask = tasks.find((task) => task.id === dragTaskId);
    if (!draggedTask || draggedTask.state === state) {
      setDragTaskId(null);
      return;
    }

    try {
      await updateTask(draggedTask.id, { state });
    } finally {
      setDragTaskId(null);
    }
  };

  const copyTaskKey = async (task: Task) => {
    if (!task.key || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(task.key);
      setCopiedTaskKeyId(task.id);
      window.setTimeout(() => {
        setCopiedTaskKeyId((current) => (current === task.id ? null : current));
      }, 2000);
    } catch {
      /* ignore */
    }
  };

  const dateTriggerClass =
    "h-9 min-w-0 max-w-[min(20rem,100%)] shrink-0 justify-start gap-1.5 border-border/60 bg-transparent text-xs sm:max-w-[20rem] sm:text-sm";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="inline-flex shrink-0 rounded-lg border border-border/60 bg-card/80 p-0.5 shadow-sm backdrop-blur-sm">
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-8 px-3"
              onClick={() => setAndStoreViewMode("list")}
            >
              {t("list")}
            </Button>
            <Button
              size="sm"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              className="h-8 px-3"
              onClick={() => setAndStoreViewMode("kanban")}
            >
              {t("kanban")}
            </Button>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-2 py-0.5 backdrop-blur-sm sm:max-w-xl lg:max-w-md xl:max-w-xl">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              className="h-8 border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
              placeholder={t("searchByKeyPlaceholder")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label={t("searchByKeyPlaceholder")}
            />
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="h-9 w-full shrink-0 gap-2 sm:w-auto sm:min-w-[10rem]"
            >
              <PlusIcon className="size-4" />
              {t("newIssue")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("createIssue")}</DialogTitle>
              <DialogDescription>{t("createIssueDesc")}</DialogDescription>
            </DialogHeader>
            <TaskForm
              form={form}
              setForm={setForm}
              formError={formError}
              members={members}
              membersLoading={membersLoading}
              epics={activeEpics}
              epicsLoading={epicsLoading}
              sprints={allSprints}
              sprintsLoading={sprintsLoading}
              sprintPickerLabels={{
                none: tSprints("sprintPickerNone"),
                search: tSprints("sprintPickerSearch"),
                empty: tSprints("sprintPickerEmpty"),
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={closeDialogs}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={submitCreate} disabled={submitting}>
                {tCommon("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <TasksWorkspaceFilterDeck>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-2 sm:gap-y-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Select
              value={filters.state ?? "ALL"}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, state: value as TaskState | "ALL" }))}
            >
              <SelectTrigger className="w-full sm:w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("allStates")}</SelectItem>
                {TASK_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {TASK_STATE_LABELS[state]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.priority ?? "ALL"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, priority: value as TaskPriority | "ALL" }))
              }
            >
              <SelectTrigger className="w-full sm:w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("allPriorities")}</SelectItem>
                {TASK_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {TASK_PRIORITY_LABELS[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.assigneeId ?? "ALL"}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, assigneeId: value || "ALL" }))}
            >
              <SelectTrigger className="w-full sm:w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("allAssignees")}</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.epicId ?? "ALL"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, epicId: (value || "ALL") as string | "ALL" }))
              }
            >
              <SelectTrigger className="w-full sm:w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("filterAllEpics")}</SelectItem>
                {activeEpics.map((epic) => (
                  <SelectItem key={epic.id} value={epic.id}>
                    {epic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.sprintId ?? "ALL"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, sprintId: (value || "ALL") as string | "ALL" }))
              }
            >
              <SelectTrigger className="w-full sm:w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("filterAllSprints")}</SelectItem>
                {allSprints.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DateRangePicker
              ariaLabel={`${t("dueFrom")} — ${t("dueTo")}`}
              from={filters.dueFrom ?? ""}
              to={filters.dueTo ?? ""}
              onFromChange={(value) => setFilters((prev) => ({ ...prev, dueFrom: value }))}
              onToChange={(value) => setFilters((prev) => ({ ...prev, dueTo: value }))}
              placeholder={`${t("dueFrom")} — ${t("dueTo")}`}
              triggerClassName={dateTriggerClass}
            />
          </div>
        </div>
      </TasksWorkspaceFilterDeck>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? <p className="text-sm text-muted-foreground">{t("loadingIssues")}</p> : null}

      {!loading && viewMode === "list" ? (
          <div className="tasks-data-table-wrap">
            <Table className="tasks-data-table min-w-[1000px]">
              <TableHeader className="tasks-table-head">
                <TableRow className="text-left hover:bg-transparent">
                  <SortableTh
                    column="key"
                    label={t("taskKey")}
                    sort={listSort}
                    onSort={toggleListSort}
                    toggleSortLabel={t("toggleSort")}
                    className="whitespace-nowrap"
                  />
                  <SortableTh
                    column="title"
                    label={t("columnIssue")}
                    sort={listSort}
                    onSort={toggleListSort}
                    toggleSortLabel={t("toggleSort")}
                  />
                  <SortableTh
                    column="state"
                    label={t("state")}
                    sort={listSort}
                    onSort={toggleListSort}
                    toggleSortLabel={t("toggleSort")}
                  />
                  <SortableTh
                    column="priority"
                    label={t("priority")}
                    sort={listSort}
                    onSort={toggleListSort}
                    toggleSortLabel={t("toggleSort")}
                  />
                  <SortableTh
                    column="epic"
                    label={t("epic")}
                    sort={listSort}
                    onSort={toggleListSort}
                    toggleSortLabel={t("toggleSort")}
                  />
                  <SortableTh
                    column="sprint"
                    label={t("sprint")}
                    sort={listSort}
                    onSort={toggleListSort}
                    toggleSortLabel={t("toggleSort")}
                  />
                  <SortableTh
                    column="assignee"
                    label={t("assignee")}
                    sort={listSort}
                    onSort={toggleListSort}
                    toggleSortLabel={t("toggleSort")}
                  />
                  <SortableTh
                    column="dueDate"
                    label={t("dueDateCol")}
                    sort={listSort}
                    onSort={toggleListSort}
                    toggleSortLabel={t("toggleSort")}
                  />
                  <TableHead className="px-3 py-2.5 text-muted-foreground">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTasks.map((task, rowIndex) => (
                  <TableRow
                    key={task.id}
                    className="tasks-table-row"
                    style={{ "--stagger": Math.min(rowIndex * 22, 440) } as CSSProperties}
                  >
                    <TableCell className="whitespace-nowrap px-3 py-2 align-top">
                      {task.key ? (
                        <div className="flex items-center gap-0.5">
                          <span className="font-mono text-[11px] tabular-nums tracking-tight text-primary/85">
                            {task.key}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                            title={t("copyTaskKey")}
                            aria-label={t("copyTaskKey")}
                            onClick={() => void copyTaskKey(task)}
                          >
                            {copiedTaskKeyId === task.id ? (
                              <CheckIcon className="size-3.5 text-primary" />
                            ) : (
                              <CopyIcon className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[min(420px,40vw)] px-3 py-2 align-top whitespace-normal">
                      <p className="text-sm font-medium leading-snug tracking-tight">{task.title}</p>
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      <Badge variant="outline" className="font-normal">
                        {TASK_STATE_LABELS[task.state]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      {task.priority === "NONE" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      {task.epic ? (
                        <EpicBadge
                          epic={task.epic}
                          statusLabel={tEpic(`status.${task.epic.status}`)}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      {task.sprint ? (
                        <SprintBadge
                          sprint={task.sprint}
                          statusLabel={tSprints(`status.${task.sprint.status}`)}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      {task.assignee ? (
                        <div className="flex max-w-[180px] items-center gap-2">
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border/50 bg-gradient-to-br from-muted to-muted/60 text-[10px] font-semibold uppercase text-muted-foreground shadow-sm"
                            title={task.assignee.name}
                          >
                            {assigneeInitials(task.assignee.name)}
                          </span>
                          <span className="truncate text-sm">{task.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(task.dueDate)}</TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(task)}>
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTaskId(task.id)}>
                          <TrashIcon className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {!loading && viewMode === "kanban" ? (
          <>
            <div
              className="mb-3 flex items-center gap-2 lg:hidden"
              role="toolbar"
              aria-label={t("kanbanColumn")}
            >
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{t("kanbanColumn")}</span>
              <Select
                value={kanbanMobileColumn}
                onValueChange={(value) => {
                  const s = value as TaskState;
                  setKanbanMobileColumn(s);
                  requestAnimationFrame(() => {
                    kanbanColRefs.current[s]?.scrollIntoView({
                      behavior: "smooth",
                      inline: "start",
                      block: "nearest",
                    });
                  });
                }}
              >
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATES.map((state) => {
                    const count = sortedTasks.filter((task) => task.state === state).length;
                    return (
                      <SelectItem key={state} value={state}>
                        {`${TASK_STATE_LABELS[state]} (${count})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="tasks-kanban-scroll -mx-1 flex w-full snap-x snap-mandatory gap-3 overflow-x-auto scroll-pb-2 px-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-3 lg:overflow-visible lg:pb-0 lg:snap-none">
            {TASK_STATES.map((state) => {
              const columnTasks = sortedTasks.filter((task) => task.state === state);
              return (
                <div
                  key={state}
                  ref={(el) => {
                    kanbanColRefs.current[state] = el;
                  }}
                  className="tasks-board-column min-h-[420px] w-[min(20rem,calc(100vw-2.5rem))] shrink-0 snap-start p-3 lg:w-auto lg:min-w-0 lg:shrink"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDropToState(state)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {TASK_STATE_LABELS[state]}
                    </h3>
                    <Badge variant="secondary" className="font-mono text-[11px] font-normal tabular-nums">
                      {columnTasks.length}
                    </Badge>
                  </div>

                  <div className="space-y-2.5">
                    {columnTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDragTaskId(task.id)}
                        className="tasks-board-card cursor-grab p-3 active:cursor-grabbing"
                      >
                        <p className="mb-1.5 text-sm leading-snug">
                          {task.key ? (
                            <>
                              <span className="font-mono text-[11px] tabular-nums text-primary/85">{task.key}</span>
                              <span className="text-muted-foreground/80"> · </span>
                            </>
                          ) : null}
                          <span className="font-medium tracking-tight">{task.title}</span>
                        </p>
                        {task.description ? (
                          <div className="mb-2">
                            <MarkdownContent content={task.description} className="text-xs text-muted-foreground" clamped />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewDescriptionTask(task);
                              }}
                            >
                              <FileTextIcon className="mr-1 size-3" />
                              {t("more")}
                            </Button>
                          </div>
                        ) : null}
                        {(task.epic || task.sprint || task.priority !== "NONE") ? (
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            {task.epic ? (
                              <EpicBadge
                                epic={task.epic}
                                statusLabel={tEpic(`status.${task.epic.status}`)}
                              />
                            ) : null}
                            {task.epic && task.sprint ? (
                              <span className="text-muted-foreground text-xs" aria-hidden>
                                ·
                              </span>
                            ) : null}
                            {task.sprint ? (
                              <SprintBadge
                                sprint={task.sprint}
                                statusLabel={tSprints(`status.${task.sprint.status}`)}
                              />
                            ) : null}
                            {task.priority !== "NONE" ? (
                              <Badge variant="outline" className="text-xs font-normal">
                                {TASK_PRIORITY_LABELS[task.priority]}
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <div className="flex min-w-0 items-center gap-2">
                            {task.assignee ? (
                              <>
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/40 bg-muted/80 text-[9px] font-semibold uppercase shadow-sm">
                                  {assigneeInitials(task.assignee.name)}
                                </span>
                                <span className="truncate">{task.assignee.name}</span>
                              </>
                            ) : (
                              <span>{t("unassigned")}</span>
                            )}
                            <span aria-hidden>·</span>
                            <span>
                              {t("due")} {formatDate(task.dueDate)}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(task)}>
                              <PencilIcon className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTaskId(task.id)}>
                              <TrashIcon className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </>
        ) : null}

      <Dialog open={Boolean(editingTask)} onOpenChange={(open) => (open ? null : closeDialogs())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {editingTask?.key ? (
                <span className="font-mono text-sm font-normal text-muted-foreground">
                  {editingTask.key}
                </span>
              ) : null}
              <span>{t("editIssue")}</span>
            </DialogTitle>
            <DialogDescription>
              {editingTask ? editingTask.title : t("editIssueDesc")}
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            form={form}
            setForm={setForm}
            formError={formError}
            members={members}
            membersLoading={membersLoading}
            epics={activeEpics}
            epicsLoading={epicsLoading}
            sprints={allSprints}
            sprintsLoading={sprintsLoading}
            sprintPickerLabels={{
              none: tSprints("sprintPickerNone"),
              search: tSprints("sprintPickerSearch"),
              empty: tSprints("sprintPickerEmpty"),
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={submitEdit} disabled={submitting}>
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewDescriptionTask)} onOpenChange={(open) => (open ? null : setViewDescriptionTask(null))}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {viewDescriptionTask?.key ? (
                <span className="font-mono text-sm font-normal text-muted-foreground">
                  {viewDescriptionTask.key}
                </span>
              ) : null}
              <span>{viewDescriptionTask?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            {viewDescriptionTask?.description ? (
              <MarkdownContent content={viewDescriptionTask.description} className="text-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTaskId)} onOpenChange={(open) => (open ? null : setDeleteTaskId(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteIssue")}</DialogTitle>
            <DialogDescription>{t("deleteIssueDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTaskId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TaskFormProps = {
  form: TaskFormState;
  setForm: Dispatch<SetStateAction<TaskFormState>>;
  formError: string | null;
  members: Array<{ id: string; name: string }>;
  membersLoading: boolean;
  epics: EpicListItem[];
  epicsLoading: boolean;
  sprints: import("@/lib/hooks/use-sprints").SprintListItem[];
  sprintsLoading: boolean;
  sprintPickerLabels: { none: string; search: string; empty: string };
};

function TaskForm({
  form,
  setForm,
  formError,
  members,
  membersLoading,
  epics,
  epicsLoading,
  sprints,
  sprintsLoading,
  sprintPickerLabels,
}: TaskFormProps) {
  const t = useTranslations("Tasks");
  const tEpic = useTranslations("Epics");
  return (
    <div className="space-y-3">
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Input
        placeholder={t("issueTitlePlaceholder")}
        value={form.title}
        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
      />

      <DescriptionEditor
        value={form.description}
        onChange={(description) => setForm((prev) => ({ ...prev, description }))}
        minHeight="12rem"
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          value={form.state}
          onValueChange={(value) => setForm((prev) => ({ ...prev, state: value as TaskState }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATES.map((state) => (
              <SelectItem key={state} value={state}>
                {TASK_STATE_LABELS[state]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={form.priority}
          onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as TaskPriority }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {TASK_PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={form.assigneeId || UNASSIGNED_SELECT_VALUE}
          onValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              assigneeId:
                value === UNASSIGNED_SELECT_VALUE ? "" : (value ?? ""),
            }))
          }
          disabled={membersLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("unassigned")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_SELECT_VALUE}>{t("unassigned")}</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePicker
          value={form.dueDate}
          onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value }))}
          placeholder={t("dueDatePlaceholder")}
        />

        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t("epic")}</p>
          <EpicPicker
            value={form.epicId}
            onChange={(epicId) => setForm((prev) => ({ ...prev, epicId }))}
            epics={epics}
            disabled={epicsLoading}
            noneLabel={tEpic("epicNone")}
            searchPlaceholder={tEpic("epicSearchPlaceholder")}
            emptyLabel={tEpic("epicSearchEmpty")}
          />
        </div>

        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t("sprint")}</p>
          <SprintPicker
            value={form.sprintId}
            onChange={(sprintId) => setForm((prev) => ({ ...prev, sprintId }))}
            sprints={sprints}
            disabled={sprintsLoading}
            noneLabel={sprintPickerLabels.none}
            searchPlaceholder={sprintPickerLabels.search}
            emptyLabel={sprintPickerLabels.empty}
          />
        </div>
      </div>
    </div>
  );
}
