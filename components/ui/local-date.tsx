"use client";

import { useSyncExternalStore } from "react";
import { formatShortDate } from "@/lib/format";

const subscribe = () => () => {};

/**
 * Shows a timestamp's day in the viewer's own time zone. The server (and hydration) render the
 * UTC day, so markup matches; React then re-renders on the client with the local day.
 */
export function LocalDate({ epochMs, className, title }: { epochMs: number; className?: string; title?: string }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <time dateTime={new Date(epochMs).toISOString()} className={className} title={title}>
      {formatShortDate(epochMs, isClient ? "local" : "UTC")}
    </time>
  );
}
