import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page container: shared width, gutters and vertical rhythm. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6", className)}>{children}</main>;
}

/** Page title block with optional description and trailing content (e.g. a status badge). */
export function PageHeader({
  title,
  description,
  aside,
  className,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] leading-tight font-medium sm:text-3xl">{title}</h1>
        {aside}
      </div>
      {description && <div className="text-muted">{description}</div>}
    </header>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("mb-4 text-xl font-medium", className)}>{children}</h2>;
}
