import { formatDateRange, formatEventType } from "@/lib/format";
import type { EventContext } from "@/lib/proposals/model";

/** One-line event context, e.g. "Conference · 80 guests · 12 Nov 2026 – 13 Nov 2026". */
export function EventSummary({ event }: { event: EventContext }) {
  const parts = [
    event.eventType && formatEventType(event.eventType),
    event.guests && `${event.guests} guests`,
    formatDateRange(event.startDate, event.endDate),
  ].filter(Boolean);

  if (parts.length === 0) return <span className="text-muted">No event details</span>;
  return <span>{parts.join(" · ")}</span>;
}
