import Link from "next/link";
import type { ChangeEventHandler, ReactNode } from "react";
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

/** Single-choice pills inside a form, e.g. a dismissal reason. Native radios, so keyboard and screen readers work. */
export function ChoiceGroup({ legend, children, className }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-medium text-heading">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function ChoiceChip({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-9 cursor-pointer items-center rounded-full px-4 text-sm font-medium transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface-2",
        checked ? "bg-primary text-on-primary" : "bg-badge text-heading hover:bg-badge-hover",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}
