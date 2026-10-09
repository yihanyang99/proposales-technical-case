import { z } from "zod";
import type {
  Proposal,
  ProposalBlock,
  ProposalSearchResult,
  ProposalStatus,
} from "@/lib/proposales/schemas";

// Internal proposal model. Pure functions only: this module turns validated API data into
// the shape the UI, the recommendation engine and the revenue simulation work with.

export const PROPOSAL_STATUSES = [
  "draft",
  "active",
  "accepted",
  "rejected",
  "expired",
  "withdrawn",
  "replaced",
  "template",
] as const satisfies readonly NonNullable<ProposalStatus>[];

export type EventContext = {
  eventType: string | null;
  guests: number | null;
  startDate: string | null;
  endDate: string | null;
};

export type LineItem = {
  id: string;
  /** Content library variation_id (what a block's content_id references), if linked. */
  variationId: number | null;
  title: string;
  kind: "product" | "package";
  quantity: number | null;
  currency: string | null;
  /** Unit prices in minor units, after discount. null when the block has no price. */
  unitPriceExclVat: number | null;
  unitPriceInclVat: number | null;
  totalExclVat: number | null;
  totalInclVat: number | null;
  /** VAT rate as a fraction (0.12 = 12%), derived from the unit prices with and without VAT. */
  vatRate: number | null;
  optional: boolean;
};

export type ProposalSummary = {
  uuid: string;
  title: string;
  status: ProposalStatus;
  updatedAt: number;
  event: EventContext;
};

export type ProposalDetail = {
  uuid: string;
  companyId: number;
  language: string;
  title: string;
  description: string | null;
  status: ProposalStatus;
  currency: string | null;
  vatIncluded: boolean;
  event: EventContext;
  lineItems: LineItem[];
  totalExclVat: number | null;
  totalInclVat: number | null;
};

const UNTITLED = "Untitled proposal";

// Event context lives in integration-defined `data` metadata (no dedicated API fields).
// Each field is parsed independently so one bad value never hides the others.
const eventContextSchema = z.object({
  event_type: z.string().min(1).nullable().catch(null),
  guests: z.coerce.number().int().positive().nullable().catch(null),
  event_start: z.iso.date().nullable().catch(null),
  event_end: z.iso.date().nullable().catch(null),
});

export function toEventContext(data: Record<string, unknown>): EventContext {
  const parsed = eventContextSchema.parse(data);
  return {
    eventType: parsed.event_type,
    guests: parsed.guests,
    startDate: parsed.event_start,
    endDate: parsed.event_end,
  };
}

/** Rounded to 0.1 percentage point; null when either price is missing or the base is zero. */
export function deriveVatRate(exclVat: number | null, inclVat: number | null): number | null {
  if (exclVat === null || inclVat === null || exclVat <= 0) return null;
  return Math.round((inclVat / exclVat - 1) * 1000) / 1000;
}

export function toLineItem(block: ProposalBlock): LineItem | null {
  if (block.type !== "product-block") return null; // e.g. video blocks carry no revenue.

  const quantity = block.quantity ?? null;
  const unitPriceExclVat = block.unit_value_with_discount_without_tax ?? null;
  const unitPriceInclVat = block.unit_value_with_discount_with_tax ?? null;
  const lineTotal = (unit: number | null) => (quantity !== null && unit !== null ? quantity * unit : null);
  return {
    id: block.uuid,
    variationId: block.content_id ?? null,
    title: block.title?.trim() || "Untitled item",
    kind: block.multi_product_enabled ? "package" : "product",
    quantity,
    currency: block.currency ?? null,
    unitPriceExclVat,
    unitPriceInclVat,
    totalExclVat: lineTotal(unitPriceExclVat),
    totalInclVat: lineTotal(unitPriceInclVat),
    vatRate: deriveVatRate(unitPriceExclVat, unitPriceInclVat),
    optional: block.optional ?? false,
  };
}

export function toProposalSummary(result: ProposalSearchResult): ProposalSummary {
  return {
    uuid: result.uuid,
    title: result.title.trim() || UNTITLED,
    status: result.status,
    updatedAt: result.updated_at,
    event: toEventContext(result.data),
  };
}

export function toProposalDetail(proposal: Proposal): ProposalDetail {
  return {
    uuid: proposal.uuid,
    companyId: proposal.company_id,
    language: proposal.language,
    title: proposal.title?.trim() || UNTITLED,
    description: proposal.description_md?.trim() || null,
    status: proposal.status,
    currency: proposal.currency ?? null,
    vatIncluded: proposal.tax_options?.tax_included ?? false,
    event: toEventContext(proposal.data),
    lineItems: proposal.blocks.map(toLineItem).filter((item) => item !== null),
    totalExclVat: proposal.value_without_tax ?? null,
    totalInclVat: proposal.value_with_tax ?? null,
  };
}

export type ProposalFilters = { query: string; status: NonNullable<ProposalStatus> | null };

/** Client-side filtering, because the search API has no text or status filter. */
export function filterProposals(proposals: ProposalSummary[], filters: ProposalFilters) {
  const query = filters.query.trim().toLowerCase();
  return proposals.filter(
    (p) =>
      (!query || p.title.toLowerCase().includes(query)) &&
      (!filters.status || p.status === filters.status),
  );
}

/** Number of proposals per status among those matching the text query, in display order. */
export function countByStatus(proposals: ProposalSummary[], query: string) {
  const matching = filterProposals(proposals, { query, status: null });
  return PROPOSAL_STATUSES.map((status) => ({
    status,
    count: matching.filter((p) => p.status === status).length,
  })).filter(({ count }) => count > 0);
}

/** URL for the proposal list with the given filters; empty values are left out. */
export function proposalListHref(filters: ProposalFilters): string {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.status) params.set("status", filters.status);
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

export function parseProposalFilters(params: Record<string, string | string[] | undefined>): ProposalFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const status = z.enum(PROPOSAL_STATUSES).safeParse(first(params.status));
  return { query: first(params.q).slice(0, 100), status: status.success ? status.data : null };
}
