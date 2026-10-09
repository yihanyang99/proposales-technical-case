// Display formatting. Money is stored in minor units (cents), as returned by Proposales.

export function formatMoney(minorUnits: number | null, currency: string | null): string {
  if (minorUnits === null || !currency) return "Price unavailable";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minorUnits / 100);
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

export function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Calendar day of a timestamp, in UTC (default), an IANA zone, or the runtime's "local" zone. */
export function formatShortDate(epochMs: number, timeZone: string = "UTC"): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: timeZone === "local" ? undefined : timeZone,
  }).format(new Date(epochMs));
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null) return "–";
  return new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(fraction);
}

export function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatEventType(eventType: string): string {
  const spaced = eventType.replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
