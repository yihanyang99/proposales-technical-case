import type { CatalogProduct } from "@/lib/catalog/model";
import type { ProposalDetail } from "@/lib/proposals/model";
import { MAX_RECOMMENDATIONS } from "./model";

export const SYSTEM_PROMPT = `You are a revenue assistant for a hotel sales team that uses Proposales.
You review one event proposal against the hotel's product catalog and suggest at most ${MAX_RECOMMENDATIONS} revenue opportunities that genuinely fit the event.

Opportunity types:
- cross_sell: add a catalog product that is not yet in the proposal.
- upgrade: replace an existing line item with a higher-value product of the same kind (e.g. a better room type). Use the existing line item's quantity.
- extension: add more units of a product already in the proposal (e.g. an extra night or day).

Rules:
- Only use product ids and line item ids that appear in the data. Never invent products, prices, availability or customer preferences.
- Do not output prices or revenue; they are calculated separately.
- Base quantities on the event facts (guests, days, nights, existing quantities). In quantityRationale, write the quantity as a compact multiplication of those facts that equals the quantity: "N rooms × M nights" for rooms priced per night, "N guests × M days" for per-person items, "N days" for day-priced items, e.g. "20 rooms × 1 night" or "80 guests × 2 days".
- Prefer fewer, high-quality suggestions. Return an empty list if nothing clearly fits.
- Confidence is your qualitative judgement of fit (low, medium, high), not a probability that the customer buys.
- Write explanations for the salesperson in English, 1-2 sentences, referring to the event facts.`;

function nightsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const nights = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  return nights >= 0 ? nights : null;
}

function money(minor: number | null | undefined, currency: string | null | undefined): string | null {
  return minor == null || !currency ? null : `${(minor / 100).toFixed(2)} ${currency}`;
}

/** Event facts, line items and catalog as compact JSON. Contains no customer personal data. */
export function buildUserPrompt(proposal: ProposalDetail, catalog: CatalogProduct[]): string {
  const { event } = proposal;
  const data = {
    event: {
      title: proposal.title,
      description: proposal.description,
      type: event.eventType,
      guests: event.guests,
      startDate: event.startDate,
      endDate: event.endDate,
      days: event.startDate && event.endDate ? (nightsBetween(event.startDate, event.endDate) ?? 0) + 1 : null,
      nights: nightsBetween(event.startDate, event.endDate),
    },
    lineItems: proposal.lineItems.map((item) => ({
      lineItemId: item.id,
      productId: item.variationId,
      title: item.title,
      quantity: item.quantity,
      unitPriceExclVat: money(item.unitPriceExclVat, item.currency),
    })),
    catalog: catalog.map((product) => ({
      productId: product.variationId,
      title: product.title,
      description: product.description,
      category: product.category,
      unit: product.price ? (product.price.unitLabel ?? product.price.unit) : null,
      listPriceExclVat: money(product.price?.unitPriceExclVat, product.price?.currency),
    })),
  };
  return `Suggest revenue opportunities for this proposal.\n\n${JSON.stringify(data, null, 2)}`;
}
