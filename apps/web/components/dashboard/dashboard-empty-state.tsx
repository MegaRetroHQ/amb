"use client";

import { FolderKanbanIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@amb-app/ui/components/empty-state";

export function DashboardEmptyState() {
  const t = useTranslations("Dashboard");

  return (
    <EmptyState
      icon={<FolderKanbanIcon className="size-6" />}
      title={t("emptyStateTitle")}
      description={
        <span>
          {t("emptyStateDescription")}
          <br />
          {t("emptyStateHint")}
        </span>
      }
      className="flex-1"
    />
  );
}
