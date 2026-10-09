"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const STEP_BUTTON =
  "grid size-7 place-items-center rounded-full text-heading transition-colors hover:bg-surface-3 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:hover:bg-transparent";

export function QuantityInput({
  value,
  min,
  max,
  onChange,
  label,
  className,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    setDraft(null);
    const parsed = Number(text.trim());
    if (text.trim() === "" || !Number.isFinite(parsed)) return;
    onChange(Math.min(Math.max(Math.round(parsed), min), max));
  };

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-surface-1 p-1", className)}>
      <button type="button" className={STEP_BUTTON} onClick={() => onChange(Math.max(value - 1, min))} disabled={value <= min} aria-label={`Decrease ${label}`}>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
          <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
          if (event.key === "Escape") setDraft(null);
        }}
        className="w-14 bg-transparent text-center text-sm font-medium text-heading tabular-nums focus:outline-none"
      />
      <button type="button" className={STEP_BUTTON} onClick={() => onChange(Math.min(value + 1, max))} disabled={value >= max} aria-label={`Increase ${label}`}>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
          <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
