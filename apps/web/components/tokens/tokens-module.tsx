"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CopyIcon, CheckIcon, PlusIcon, BanIcon, InfoIcon, KeyRoundIcon } from "lucide-react";

import { useProjectTokens } from "@/lib/hooks/use-project-tokens";
import { Button } from "@amb-app/ui/components/button";
import { Card } from "@amb-app/ui/components/card";
import { EmptyState } from "@amb-app/ui/components/empty-state";
import { Input } from "@amb-app/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@amb-app/ui/components/select";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
} from "@amb-app/ui/components/page-header";
import { Badge } from "@amb-app/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@amb-app/ui/components/dialog";
import { getLocalizedApiErrorMessage } from "@/lib/api/error-i18n";

type Props = {
  projectId: string;
  projectName: string;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function TokensModule({ projectId, projectName }: Props) {
  const t = useTranslations("Tokens");
  const tCommon = useTranslations("Common");
  const { tokens, loading, error, createToken, revokeToken } = useProjectTokens(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const EXPIRY_OPTIONS: { value: number; labelKey: "expiresIn1Hour" | "expiresIn1Day" | "expiresIn7Days" | "expiresIn30Days" | "expiresIn90Days" }[] = [
  { value: 3600, labelKey: "expiresIn1Hour" },
  { value: 86400, labelKey: "expiresIn1Day" },
  { value: 604800, labelKey: "expiresIn7Days" },
  { value: 2592000, labelKey: "expiresIn30Days" },
  { value: 7776000, labelKey: "expiresIn90Days" },
];
  const [expiresIn, setExpiresIn] = useState(2592000);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const submitCreate = async () => {
    if (!name.trim()) return;

    setSubmitting(true);
    setCreateError(null);
    try {
      const data = await createToken({
        name: name.trim(),
        expiresIn: expiresIn > 0 ? expiresIn : undefined,
      });
      setCreatedToken(data.accessToken);
      setName("");
      setExpiresIn(2592000);
    } catch (submitError) {
      setCreateError(getLocalizedApiErrorMessage(submitError, tCommon));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCreatedToken = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1500);
  };

  const handleRevoke = async (tokenId: string) => {
    setRevokingId(tokenId);
    try {
      await revokeToken(tokenId);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderEyebrow>{t("title")}</PageHeaderEyebrow>
          <PageHeaderTitle>{t("title")}</PageHeaderTitle>
          <PageHeaderDescription>
            {t("projectLabel")}: {projectName}
          </PageHeaderDescription>
        </PageHeaderContent>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setCreatedToken(null);
              setCreateError(null);
            }
          }}
        >
          <PageHeaderActions>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusIcon className="size-4" />
                {t("createToken")}
              </Button>
            </DialogTrigger>
          </PageHeaderActions>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createToken")}</DialogTitle>
              <DialogDescription>{t("createTokenDesc")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                placeholder={t("tokenNamePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t("expiresInLabel")}</label>
                <Select value={String(expiresIn)} onValueChange={(value) => setExpiresIn(Number(value))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map(({ value, labelKey }) => (
                      <SelectItem key={value} value={String(value)}>
                        {t(labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}

              {createdToken ? (
                <Card className="p-3 space-y-2 min-w-0">
                  <p className="text-xs text-muted-foreground">{t("tokenCreated")}</p>
                  <textarea
                    readOnly
                    value={createdToken}
                    className="min-h-24 w-full rounded-md border bg-muted p-2 text-xs font-mono leading-relaxed break-all whitespace-pre-wrap"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyCreatedToken} className="w-full gap-2">
                    {copiedToken ? <CheckIcon className="size-4 text-green-600" /> : <CopyIcon className="size-4" />}
                    {t("copyToken")}
                  </Button>
                </Card>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {tCommon("close")}
              </Button>
              <Button onClick={submitCreate} disabled={submitting || !name.trim()}>
                {submitting ? t("creatingToken") : t("createToken")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <InfoIcon className="mt-0.5 size-4 text-muted-foreground" />
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("usageTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("usageDescription")}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t("usageStep1")}</li>
              <li>{t("usageStep2")}</li>
              <li>{t("usageStep3")}</li>
            </ul>
          </div>
        </div>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">{tCommon("loading")}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-2">
        {tokens.map((token) => (
          <Card key={token.id} className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{token.name}</p>
                  {token.revokedAt ? (
                    <Badge variant="destructive">{t("revoked")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("active")}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("createdAt")}: {formatDate(token.createdAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("lastUsedAt")}: {formatDate(token.lastUsedAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("expiresAt")}: {formatDate(token.expiresAt)}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleRevoke(token.id)}
                disabled={Boolean(token.revokedAt) || revokingId === token.id}
              >
                <BanIcon className="size-4" />
                {t("revoke")}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {!loading && tokens.length === 0 ? (
        <EmptyState
          icon={<KeyRoundIcon className="size-6" />}
          title={t("empty")}
          description={t("usageDescription")}
        />
      ) : null}
    </div>
  );
}
