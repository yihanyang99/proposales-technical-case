import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TotalsRow = { label: ReactNode; value: ReactNode; emphasis?: boolean };

/**
 * Invoice-style summary (e.g. Subtotal / VAT / Total) below a divider line, right-aligned on
 * wide screens. The `emphasis` row is the final figure: larger, bold and separated by spacing.
 */
export function Totals({ rows, note, className }: { rows: TotalsRow[]; note?: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-5 mt-1 flex flex-col gap-3 border-t border-divider pt-4 pb-3 sm:flex-row sm:justify-between", className)}>
      {/* Optional note on the left, e.g. the VAT basis of the prices above. */}
      <p className="text-xs text-muted">{note}</p>
      <dl className="w-full shrink-0 space-y-2 text-sm whitespace-nowrap sm:ml-auto sm:w-auto sm:min-w-64">
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex items-baseline justify-between gap-6",
            row.emphasis ? "pt-2 text-base font-semibold text-heading" : "text-muted",
          )}
        >
          <dt>{row.label}</dt>
          <dd className="tabular-nums">{row.value}</dd>
        </div>
      ))}
      </dl>
    </div>
  );
}
