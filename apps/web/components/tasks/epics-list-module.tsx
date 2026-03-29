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
import { useEpics } from "@/lib/hooks/use-epics";
import { getLocalizedApiErrorMessage } from "@/lib/api/error-i18n";
import { EPIC_STATUSES } from "@amb-app/shared";
import type { Epic, EpicStatus } from "@amb-app/shared";
import {
  TasksWorkspaceEmpty,
  TasksWorkspaceFilterDeck,
  TasksWorkspaceToolRow,
  tasksWorkspacePrimaryButtonClass,
} from "@/components/tasks/tasks-workspace-shell";
import { cn } from "@amb-app/ui/lib/utils";

type EpicsListModuleProps = {
  projectId: string;
};

export function EpicsListModule({ projectId }: EpicsListModuleProps) {
  const t = useTranslations("Epics");
  const tCommon = useTranslations("Common");
  const [statusFilter, setStatusFilter] = useState<EpicStatus | "ALL">("ALL");
  const { epics, loading, error, createEpic, updateEpic, archiveEpic } = useEpics(
    projectId,
    statusFilter,
  );
  const { epics: allEpics } = useEpics(projectId, "ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Epic | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<EpicStatus>("OPEN");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setFormTitle("");
    setFormDescription("");
    setFormStatus("OPEN");
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (epic: Epic) => {
    setEditing(epic);
    setFormTitle(epic.title);
    setFormDescription(epic.description ?? "");
    setFormStatus(epic.status);
    setFormError(null);
  };

  const submitCreate = async () => {
    if (!formTitle.trim()) {
      setFormError(t("titleRequired"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createEpic({
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        status: formStatus,
      });
      setCreateOpen(false);
    } catch (e) {
      setFormError(getLocalizedApiErrorMessage(e, tCommon));
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!editing || !formTitle.trim()) {
      setFormError(t("titleRequired"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await updateEpic(editing.id, {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        status: formStatus,
      });
      setEditing(null);
    } catch (e) {
      setFormError(getLocalizedApiErrorMessage(e, tCommon));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveId) return;
    try {
      await archiveEpic(archiveId);
      setArchiveId(null);
    } catch (e) {
      setFormError(getLocalizedApiErrorMessage(e, tCommon));
    }
  };

  const statusCounts = {
    ALL: allEpics.length,
    OPEN: allEpics.filter((epic) => epic.status === "OPEN").length,
    IN_PROGRESS: allEpics.filter((epic) => epic.status === "IN_PROGRESS").length,
    DONE: allEpics.filter((epic) => epic.status === "DONE").length,
    ARCHIVED: allEpics.filter((epic) => epic.status === "ARCHIVED").length,
  } as const;

  const statusOptions: Array<{ value: EpicStatus | "ALL"; label: string }> = [
    { value: "ALL", label: t("statusAll").replace(/\s*\(.+\)\s*$/, "") },
    ...EPIC_STATUSES.map((status) => ({
      value: status,
      label: t(`status.${status}`),
    })),
  ];

  return (
    <div className="space-y-3">
      <TasksWorkspaceToolRow
        deck={
          <TasksWorkspaceFilterDeck>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
              <span className="tasks-kicker">{t("listTitle")}</span>
              <div
                className="inline-flex flex-wrap items-center gap-1"
                role="tablist"
                aria-label={t("filterStatus")}
              >
                {statusOptions.map((option) => {
                  const isActive = statusFilter === option.value;
                  const count = statusCounts[option.value];

                  return (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn("h-8 gap-1.5 rounded-md px-3", isActive && "shadow-sm")}
                      onClick={() => setStatusFilter(option.value)}
                      role="tab"
                      aria-selected={isActive}
                    >
                      <span>{option.label}</span>
                      <span className="text-muted-foreground">({count})</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </TasksWorkspaceFilterDeck>
        }
        actions={
          <Button className={cn("gap-2", tasksWorkspacePrimaryButtonClass)} onClick={openCreate}>
            <PlusIcon className="size-4" />
            {t("newEpic")}
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {formError && !createOpen && !editing ? (
        <p className="text-sm text-destructive">{formError}</p>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

      {!loading && epics.length === 0 ? <TasksWorkspaceEmpty>{t("empty")}</TasksWorkspaceEmpty> : null}

      {!loading && epics.length > 0 ? (
        <div className="tasks-data-table-wrap">
          <Table className="min-w-[640px]">
            <TableHeader className="tasks-table-head">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">{t("columnTitle")}</TableHead>
                <TableHead className="px-3">{t("columnStatus")}</TableHead>
                <TableHead className="px-3">{t("columnTasks")}</TableHead>
                <TableHead className="px-3">{t("columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epics.map((epic, rowIndex) => (
                <TableRow
                  key={epic.id}
                  className="tasks-table-row"
                  style={{ "--stagger": Math.min(rowIndex * 22, 440) } as CSSProperties}
                >
                  <TableCell className="px-3 py-2">
                    <Link
                      href={`/tasks/epics/${epic.id}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {epic.title}
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Badge variant="outline">{t(`status.${epic.status}`)}</Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 tabular-nums">{epic._count?.tasks ?? "—"}</TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(epic)}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setArchiveId(epic.id)}
                        disabled={epic.status === "ARCHIVED"}
                        title={t("archive")}
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
            <DialogTitle>{t("createEpic")}</DialogTitle>
            <DialogDescription>{t("createEpicDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={t("epicTitlePlaceholder")}
            />
            <DescriptionEditor
              value={formDescription}
              onChange={setFormDescription}
              minHeight="8rem"
            />
            <Select
              value={formStatus}
              onValueChange={(value) => setFormStatus(value as EpicStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EPIC_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <DialogTitle>{t("editEpic")}</DialogTitle>
            <DialogDescription>{t("editEpicDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={t("epicTitlePlaceholder")}
            />
            <DescriptionEditor
              value={formDescription}
              onChange={setFormDescription}
              minHeight="8rem"
            />
            <Select
              value={formStatus}
              onValueChange={(value) => setFormStatus(value as EpicStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EPIC_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <Dialog open={Boolean(archiveId)} onOpenChange={(o) => !o && setArchiveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archiveEpic")}</DialogTitle>
            <DialogDescription>{t("archiveEpicDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void confirmArchive()}>
              {t("archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
