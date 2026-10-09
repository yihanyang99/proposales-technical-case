import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Form fields: white pills on the page grey, no borders, focus ring for keyboard users.
const FIELD =
  "w-full rounded-full bg-surface-2 text-sm text-heading placeholder:text-muted " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(FIELD, "h-12 px-5", className)} {...props} />;
}

/** Compact search field with a magnifier icon. `className` applies to the wrapper (e.g. width). */
export function SearchInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div className={cn("relative", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
      >
        <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input type="search" className={cn(FIELD, "h-9 pr-4 pl-10")} {...props} />
    </div>
  );
}

/** Visually hidden label; every field needs an accessible name. */
export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("sr-only", className)} {...props} />;
}
