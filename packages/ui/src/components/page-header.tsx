import * as React from "react";

import { cn } from "../lib/utils";

export function PageHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-4 md:flex-row md:items-start md:justify-between",
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}

export function PageHeaderContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("min-w-0 space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeaderEyebrow({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeaderTitle({
  className,
  ...props
}: React.ComponentProps<"h1">) {
  return <h1 className={cn("text-2xl font-semibold tracking-tight", className)} {...props} />;
}

export function PageHeaderDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return <p className={cn("max-w-3xl text-sm text-muted-foreground", className)} {...props} />;
}

export function PageHeaderActions({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center", className)}
      {...props}
    >
      {children}
    </div>
  );
}
