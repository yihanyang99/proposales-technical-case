import type { CatalogProduct } from "@/lib/catalog/model";
import type { LineItem } from "@/lib/proposals/model";

// Deterministic revenue math in integer minor units. The model never supplies prices.

export type Uplift = {
  amountInclVat: number;
  amountExclVat: number;
  currency: string;
  quantity: number;
  /** Per-unit prices used for the amount (for an upgrade: the replacement's price). */
  unitPriceExclVat: number;
  unitPriceInclVat: number;
  /** Upgrade only: the current line item's unit prices that are subtracted. */
  replacedUnitPriceExclVat: number | null;
  replacedUnitPriceInclVat: number | null;
  /** VAT rate of what is added (fraction, e.g. 0.12); null when unknown. */
  vatRate: number | null;
};

/** Unit price including VAT, rounded per unit like Proposales block values. */
export function withVat(unitExclVat: number, vatRate: number): number {
  return Math.round(unitExclVat * (1 + vatRate));
}

type Opportunity =
  | { type: "cross_sell"; product: CatalogProduct; quantity: number }
  | { type: "extension"; lineItem: LineItem; quantity: number }
  | { type: "upgrade"; product: CatalogProduct; lineItem: LineItem; quantity: number };

/**
 * Potential additional revenue for one opportunity, or null when it cannot be computed safely
 * (missing price, currency different from the proposal, or no positive gain).
 */
export function calculateUplift(opportunity: Opportunity, proposalCurrency: string | null): Uplift | null {
  if (!proposalCurrency) return null;
  const { quantity } = opportunity;

  if (opportunity.type === "cross_sell") {
    const price = opportunity.product.price;
    if (!price || price.currency !== proposalCurrency) return null;
    const unitPriceInclVat = withVat(price.unitPriceExclVat, price.vatRate);
    return {
      amountExclVat: price.unitPriceExclVat * quantity,
      amountInclVat: unitPriceInclVat * quantity,
      currency: proposalCurrency,
      quantity,
      unitPriceExclVat: price.unitPriceExclVat,
      unitPriceInclVat,
      replacedUnitPriceExclVat: null,
      replacedUnitPriceInclVat: null,
      vatRate: price.vatRate,
    };
  }

  if (opportunity.type === "extension") {
    const { lineItem } = opportunity;
    if (lineItem.currency !== proposalCurrency || lineItem.unitPriceExclVat === null || lineItem.unitPriceInclVat === null) {
      return null;
    }
    return {
      amountExclVat: lineItem.unitPriceExclVat * quantity,
      amountInclVat: lineItem.unitPriceInclVat * quantity,
      currency: proposalCurrency,
      quantity,
      unitPriceExclVat: lineItem.unitPriceExclVat,
      unitPriceInclVat: lineItem.unitPriceInclVat,
      replacedUnitPriceExclVat: null,
      replacedUnitPriceInclVat: null,
      vatRate: lineItem.vatRate,
    };
  }

  const { product, lineItem } = opportunity;
  const price = product.price;
  if (
    !price ||
    price.currency !== proposalCurrency ||
    lineItem.currency !== proposalCurrency ||
    lineItem.unitPriceExclVat === null ||
    lineItem.unitPriceInclVat === null
  ) {
    return null;
  }
  const replacementInclVat = withVat(price.unitPriceExclVat, price.vatRate);
  const exclDelta = price.unitPriceExclVat - lineItem.unitPriceExclVat;
  const inclDelta = replacementInclVat - lineItem.unitPriceInclVat;
  if (exclDelta <= 0 || inclDelta <= 0) return null;
  return {
    amountExclVat: exclDelta * quantity,
    amountInclVat: inclDelta * quantity,
    currency: proposalCurrency,
    quantity,
    unitPriceExclVat: price.unitPriceExclVat,
    unitPriceInclVat: replacementInclVat,
    replacedUnitPriceExclVat: lineItem.unitPriceExclVat,
    replacedUnitPriceInclVat: lineItem.unitPriceInclVat,
    vatRate: price.vatRate,
  };
}
