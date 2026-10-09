import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** White rounded surface on the grey page. `interactive` adds hover and focus styles (for links). */
export function cardStyles({ interactive = false }: { interactive?: boolean } = {}) {
  return cn(
    "rounded-xl bg-surface-2",
    interactive &&
      "transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(cardStyles(), className)} {...props} />;
}
