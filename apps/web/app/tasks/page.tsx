"use client";

import Link from "next/link";
import { useProjectContext } from "@/lib/context/project-context";
import { TasksModule } from "@/components/tasks/tasks-module";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

export default function TasksPage() {
  const { selectedProject, loading } = useProjectContext();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">Select a project in the Dashboard</p>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeftIcon className="mr-2 size-4" />
            To Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <TasksModule projectId={selectedProject.id} projectName={selectedProject.name} />
  );
}
