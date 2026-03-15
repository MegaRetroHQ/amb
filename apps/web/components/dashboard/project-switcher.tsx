"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanbanIcon,
  PlusIcon,
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  ListTodoIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { useProjectContext } from "@/lib/context/project-context";

export function ProjectSwitcher() {
  const { projectId, setProjectId, projects, loading, selectedProject, loadProjects: reloadProjects } = useProjectContext();
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectProject = (id: string) => {
    setProjectId(id);
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateError(json?.error?.message || "Failed to create project");
        return;
      }

      await reloadProjects();
      setNewProjectName("");
      setDialogOpen(false);
      selectProject(json.data.id);
    } finally {
      setCreating(false);
    }
  };

  const copyProjectId = async () => {
    if (!selectedProject) return;
    await navigator.clipboard.writeText(selectedProject.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <FolderKanbanIcon className="size-4" />
            <span className="max-w-[180px] truncate">
              {loading ? "Loading projects..." : (selectedProject?.name ?? "Select project")}
            </span>
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px]">
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => selectProject(project.id)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{project.name}</span>
              {selectedProject?.id === project.id && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  current
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <PlusIcon className="size-4 mr-2" />
                Create project
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>
                  Create a project and use its ID in the MCP settings of another repository.
                </DialogDescription>
              </DialogHeader>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <Input
                placeholder="Project name"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    createProject();
                  }
                }}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createProject} disabled={!newProjectName.trim() || creating}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={copyProjectId}
        disabled={!selectedProject}
        className="gap-2"
        title="Copy project ID"
      >
        {copied ? <CheckIcon className="size-4 text-green-500" /> : <CopyIcon className="size-4" />}
        <span className="hidden sm:inline">ID</span>
      </Button>

      {selectedProject ? (
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link href="/tasks">
            <ListTodoIcon className="size-4" />
            <span className="hidden sm:inline">Tasks</span>
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled className="gap-2">
          <ListTodoIcon className="size-4" />
          <span className="hidden sm:inline">Tasks</span>
        </Button>
      )}
    </div>
  );
}
