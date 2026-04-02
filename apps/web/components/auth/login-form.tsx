"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Button } from "@amb-app/ui/components/button";
import { Card } from "@amb-app/ui/components/card";
import { Input } from "@amb-app/ui/components/input";
import { getLocalizedApiErrorFromCode } from "@/lib/api/error-i18n";

function sanitizeNextPath(nextValue: string | null, locale: string): string {
  if (!nextValue || !nextValue.startsWith(`/${locale}`)) {
    return "/";
  }

  const withoutLocale = nextValue.slice(`/${locale}`.length);
  if (!withoutLocale || withoutLocale === "/") {
    return "/";
  }
  return withoutLocale;
}

export function LoginForm() {
  const isProduction = process.env.NODE_ENV === "production";
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(isProduction ? "" : "admin@local.test");
  const [password, setPassword] = useState(isProduction ? "" : "ChangeMe123!");
  const [loadingAction, setLoadingAction] = useState<"signin" | "signup" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(
    () => sanitizeNextPath(searchParams.get("next"), locale),
    [searchParams, locale]
  );

  const submitAuth = async (mode: "signin" | "signup") => {
    setLoadingAction(mode);
    setError(null);

    try {
      const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getLocalizedApiErrorFromCode(json?.error?.code, tCommon));
      }
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : tCommon("apiErrors.authFailed"));
    } finally {
      setLoadingAction(null);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;
    await submitAuth(submitter?.value === "signup" ? "signup" : "signin");
  };

  return (
    <div className="amb-login-surface flex items-center justify-center p-5 md:p-6">
      <Card className="shadow-elevation-md w-full max-w-sm border-border/80 p-6 md:p-7">
        <div className="mb-6 space-y-2 text-center sm:text-left">
          <p className="font-display text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-primary">
            Agent Message Bus
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              {t("email")}
            </label>
            <Input
              id="email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={isProduction ? "you@example.com" : "admin@local.test"}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              {t("password")}
            </label>
            <Input
              id="password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("passwordPlaceholder")}
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            value="signin"
            className="w-full"
            disabled={loadingAction !== null}
          >
            {loadingAction === "signin" ? t("signingIn") : t("signIn")}
          </Button>
          <Button
            type="submit"
            value="signup"
            variant="outline"
            className="w-full"
            disabled={loadingAction !== null}
          >
            {loadingAction === "signup" ? t("creatingAccount") : t("createAccount")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
