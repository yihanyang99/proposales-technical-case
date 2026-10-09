import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Dot, type Tone } from "./badge";

/** Inline message card for errors and notices. */
export function Alert({
  tone = "failure",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "failure" ? "alert" : "status"} className={cn("rounded-xl bg-surface-2 p-5 text-sm", className)}>
      <p className="flex items-center gap-2 font-medium text-heading">
        <Dot tone={tone} />
        {title}
      </p>
      {children && <div className="mt-1 text-muted">{children}</div>}
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
