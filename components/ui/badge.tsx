import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Colour is reserved for meaning (as on proposales.com); everything else stays neutral. */
export type Tone = "neutral" | "strong" | "success" | "failure";

const DOT: Record<Tone, string> = {
  neutral: "bg-muted",
  strong: "bg-primary",
  success: "bg-success",
  failure: "bg-failure",
};

/** Small neutral pill with an optional coloured status dot. */
export function Badge({ tone, children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-badge px-2.5 py-1 text-xs font-medium text-heading", className)}>
      {tone && <span aria-hidden="true" className={cn("size-1.5 rounded-full", DOT[tone])} />}
      {children}
    </span>
  );
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", DOT[tone], className)} />;
}
