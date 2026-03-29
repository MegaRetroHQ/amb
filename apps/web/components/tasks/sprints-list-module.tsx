"use client";

import { useState, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";

import { Badge } from "@amb-app/ui/components/badge";
import { Button } from "@amb-app/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@amb-app/ui/components/dialog";
import { Input } from "@amb-app/ui/components/input";
import { DatePicker } from "@/components/ui/date-picker";
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
import { useSprints, type SprintListItem } from "@/lib/hooks/use-sprints";
import { getLocalizedApiErrorMessage } from "@/lib/api/error-i18n";
import { SPRINT_STATUSES } from "@amb-app/shared";
import type { SprintStatus } from "@amb-app/shared";
import {
  TasksWorkspaceEmpty,
  TasksWorkspaceFilterDeck,
  TasksWorkspaceToolRow,
  tasksWorkspacePrimaryButtonClass,
} from "@/components/tasks/tasks-workspace-shell";
import { cn } from "@amb-app/ui/lib/utils";

type SprintsListModuleProps = {
  projectId: string;
};

function formatSprintRange(start: string | null, end: string | null, empty: string) {
  if (!start && !end) return empty;
  const fmt = (v: string) => new Date(v).toLocaleDateString();
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? fmt(start) : fmt(end!);
}

export function SprintsListModule({ projectId }: SprintsListModuleProps) {
  const t = useTranslations("Sprints");
  const tCommon = useTranslations("Common");
  const [statusFilter, setStatusFilter] = useState<SprintStatus | "ALL">("ALL");
  const {
    sprints,
    loading,
    error,
    createSprint,
    updateSprint,
    deletePlannedSprint,
  } = useSprints(projectId, statusFilter);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SprintListItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setFormName("");
    setFormGoal("");
    setFormStart("");
    setFormEnd("");
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (sprint: SprintListItem) => {
    setEditing(sprint);
    setFormName(sprint.name);
    setFormGoal(sprint.goal ?? "");
    setFormStart(sprint.startDate ? sprint.startDate.slice(0, 10) : "");
    setFormEnd(sprint.endDate ? sprint.endDate.slice(0, 10) : "");
    setFormError(null);
  };

  const toIsoOrNull = (dateStr: string) => {
    if (!dateStr.trim()) return null;
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const submitCreate = async () => {
    if (!formName.trim()) {
      setFormError(t("nameRequired"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createSprint({
        name: formName.trim(),
        goal: formGoal.trim() || null,
        startDate: toIsoOrNull(formStart),
        endDate: toIsoOrNull(formEnd),
      });
      setCreateOpen(false);
    } catch (e) {
      setFormError(getLocalizedApiErrorMessage(e, tCommon));
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!editing || !formName.trim()) {
      setFormError(t("nameRequired"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await updateSprint(editing.id, {
        name: formName.trim(),
        goal: formGoal.trim() || null,
        startDate: toIsoOrNull(formStart),
        endDate: toIsoOrNull(formEnd),
      });
      setEditing(null);
    } catch (e) {
      setFormError(getLocalizedApiErrorMessage(e, tCommon));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePlannedSprint(deleteId);
      setDeleteId(null);
    } catch (e) {
      setFormError(getLocalizedApiErrorMessage(e, tCommon));
    }
  };

  return (
    <div className="space-y-3">
      <TasksWorkspaceToolRow
        deck={
          <TasksWorkspaceFilterDeck>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
              <span className="tasks-kicker">{t("listTitle")}</span>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as SprintStatus | "ALL")}
              >
                <SelectTrigger className="w-full sm:w-[14rem]" aria-label={t("filterStatus")}>
                  <SelectValue placeholder={t("filterStatus")} />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="ALL">{t("statusAll")}</SelectItem>
                  {SPRINT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TasksWorkspaceFilterDeck>
        }
        actions={
          <Button className={cn("gap-2", tasksWorkspacePrimaryButtonClass)} onClick={openCreate}>
            <PlusIcon className="size-4" />
            {t("newSprint")}
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {formError && !createOpen && !editing ? (
        <p className="text-sm text-destructive">{formError}</p>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

      {!loading && sprints.length === 0 ? <TasksWorkspaceEmpty>{t("empty")}</TasksWorkspaceEmpty> : null}

      {!loading && sprints.length > 0 ? (
        <div className="tasks-data-table-wrap">
          <Table className="min-w-[720px]">
            <TableHeader className="tasks-table-head">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">{t("columnName")}</TableHead>
                <TableHead className="px-3">{t("columnDates")}</TableHead>
                <TableHead className="px-3">{t("columnStatus")}</TableHead>
                <TableHead className="px-3">{t("columnTasks")}</TableHead>
                <TableHead className="px-3">{t("columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sprints.map((sprint, rowIndex) => (
                <TableRow
                  key={sprint.id}
                  className={cn("tasks-table-row", sprint.status === "ACTIVE" && "bg-primary/5")}
                  style={{ "--stagger": Math.min(rowIndex * 22, 440) } as CSSProperties}
                >
                  <TableCell className="px-3 py-2">
                    <Link
                      href={`/tasks/sprints/${sprint.id}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {sprint.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-muted-foreground">
                    {formatSprintRange(sprint.startDate, sprint.endDate, t("noDates"))}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Badge variant={sprint.status === "ACTIVE" ? "default" : "outline"}>
                      {t(`status.${sprint.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 tabular-nums">{sprint._count?.tasks ?? "—"}</TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(sprint)}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(sprint.id)}
                        disabled={sprint.status !== "PLANNED"}
                        title={t("deletePlannedOnly")}
                      >
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createSprint")}</DialogTitle>
            <DialogDescription>{t("createSprintDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t("namePlaceholder")}
            />
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("goal")}</p>
              <DescriptionEditor value={formGoal} onChange={setFormGoal} minHeight="6rem" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePicker value={formStart} onChange={setFormStart} placeholder={t("startDate")} />
              <DatePicker value={formEnd} onChange={setFormEnd} placeholder={t("endDate")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={() => void submitCreate()} disabled={submitting}>
              {tCommon("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editSprint")}</DialogTitle>
            <DialogDescription>{t("editSprintDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t("namePlaceholder")}
            />
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("goal")}</p>
              <DescriptionEditor value={formGoal} onChange={setFormGoal} minHeight="6rem" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePicker value={formStart} onChange={setFormStart} placeholder={t("startDate")} />
              <DatePicker value={formEnd} onChange={setFormEnd} placeholder={t("endDate")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={() => void submitEdit()} disabled={submitting}>
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteSprintTitle")}</DialogTitle>
            <DialogDescription>{t("deleteSprintDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
