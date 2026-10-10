import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Borderless table inside a white card; rows are separated by spacing, not lines.

/** `footer` renders inside the same card, below the table (e.g. <Totals />). */
export function Table({ className, footer, ...props }: ComponentProps<"table"> & { footer?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2">
      <div className="overflow-x-auto">
        <table className={cn("w-full text-sm sm:min-w-[28rem]", className)} {...props} />
      </div>
      {footer}
    </div>
  );
}

export function TableHead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("text-left text-xs text-muted", className)} {...props} />;
}

export function TableHeaderCell({ className, align, ...props }: ComponentProps<"th"> & { align?: "left" | "right" }) {
  return <th scope="col" className={cn("px-5 py-3 font-medium", align === "right" ? "text-right" : "text-left", className)} {...props} />;
}

export function TableCell({ className, align, numeric, ...props }: ComponentProps<"td"> & { align?: "left" | "right"; numeric?: boolean }) {
  return (
    <td
      className={cn("px-5 py-3", (align === "right" || numeric) && "text-right", numeric && "tabular-nums", className)}
      {...props}
    />
  );
}
