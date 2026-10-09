import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Pill-shaped filter options. Links (not a <select>) so they are fully styleable in every
// browser, work without JavaScript, and keep the filter in the URL.

export function ChipGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <nav aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </nav>
  );
}

export function Chip({
  href,
  selected = false,
  count,
  children,
}: {
  href: string;
  selected?: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      scroll={false}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1",
        selected ? "bg-primary text-on-primary" : "bg-surface-2 text-heading hover:bg-surface-3",
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn("tabular-nums", selected ? "opacity-70" : "text-muted")}>{count}</span>
      )}
    </Link>
  );
}
