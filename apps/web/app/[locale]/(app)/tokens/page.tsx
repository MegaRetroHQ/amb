"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useProjectContext } from "@/lib/context/project-context";
import { TokensModule } from "@/components/tokens/tokens-module";
import { Button } from "@amb-app/ui/components/button";
import { EmptyState } from "@amb-app/ui/components/empty-state";
import { KeyRoundIcon } from "lucide-react";

export default function TokensPage() {
  const t = useTranslations("Tokens");
  const { selectedProject, loading } = useProjectContext();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <EmptyState
          icon={<KeyRoundIcon className="size-6" />}
          title={t("selectProject")}
          action={
            <Button asChild variant="outline">
              <Link href="/">{t("toDashboard")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="tasks-workspace-surface amb-shell-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="tasks-workspace-inner min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="amb-page-width px-5 py-4 md:px-6 md:py-5">
          <TokensModule projectId={selectedProject.id} projectName={selectedProject.name} />
        </div>
      </div>
    </div>
  );
}
