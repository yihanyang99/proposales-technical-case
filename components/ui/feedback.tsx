import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Dot, type Tone } from "./badge";

/** Inline message for errors and notices. `icon` replaces the tone dot; `soft` sets it apart from cards. */
export function Alert({
  tone = "failure",
  title,
  icon,
  variant = "card",
  children,
  className,
}: {
  tone?: Tone;
  title: string;
  icon?: ReactNode;
  variant?: "card" | "soft";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "failure" ? "alert" : "status"} className={cn("rounded-xl p-5 text-sm", variant === "soft" ? "bg-badge" : "bg-surface-2", className)}>
      <p className="flex items-center gap-2 font-medium text-heading">
        {icon ?? <Dot tone={tone} />}
        {title}
      </p>
      {children && <div className={cn("mt-1", variant === "soft" ? "text-body" : "text-muted")}>{children}</div>}
    </div>
  );
}

/** Centered placeholder for lists or sections without content. */
export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-surface-2 p-10 text-center text-sm text-muted", className)}>{children}</div>;
}

/** Loading placeholder. Size and radius come from `className`. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;
}
