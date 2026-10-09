import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog/model";
import type { LineItem } from "@/lib/proposals/model";
import { calculateUplift, withVat } from "./uplift";

const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  productId: 1,
  variationId: 10,
  title: "Superior Double Room",
  description: null,
  category: "accommodation",
  price: { unitPriceExclVat: 18500, currency: "EUR", vatRate: 0.12, unit: "night", unitLabel: null },
  ...overrides,
});

const lineItem = (overrides: Partial<LineItem> = {}): LineItem => ({
  id: "line-1",
  variationId: 20,
  title: "Standard Double Room",
  kind: "product",
  quantity: 40,
  currency: "EUR",
  unitPriceExclVat: 14500,
  unitPriceInclVat: 16240,
  totalExclVat: 580000,
  totalInclVat: 649600,
  vatRate: 0.12,
  optional: false,
  ...overrides,
});

describe("withVat", () => {
  it("rounds per unit to whole minor units", () => {
    expect(withVat(900, 0.12)).toBe(1008);
    expect(withVat(14500, 0.12)).toBe(16240);
    expect(withVat(333, 0.25)).toBe(416);
  });
});

describe("calculateUplift", () => {
  it("prices a cross-sell as list price × quantity in both VAT bases", () => {
    const coffee = product({ price: { unitPriceExclVat: 900, currency: "EUR", vatRate: 0.12, unit: "person", unitLabel: null } });
    expect(calculateUplift({ type: "cross_sell", product: coffee, quantity: 80 }, "EUR")).toEqual({
      amountExclVat: 72000,
      amountInclVat: 80640,
      currency: "EUR",
      quantity: 80,
      unitPriceExclVat: 900,
      unitPriceInclVat: 1008,
      replacedUnitPriceExclVat: null,
      replacedUnitPriceInclVat: null,
      vatRate: 0.12,
    });
  });

  it("prices an upgrade as the price difference × quantity", () => {
    const result = calculateUplift({ type: "upgrade", product: product(), lineItem: lineItem(), quantity: 40 }, "EUR");
    expect(result?.amountExclVat).toBe((18500 - 14500) * 40);
    expect(result?.amountInclVat).toBe((20720 - 16240) * 40);
    expect(result?.replacedUnitPriceExclVat).toBe(14500);
  });

  it("prices an extension with the line item's own prices", () => {
    const result = calculateUplift({ type: "extension", lineItem: lineItem(), quantity: 20 }, "EUR");
    expect(result?.amountExclVat).toBe(14500 * 20);
    expect(result?.amountInclVat).toBe(16240 * 20);
    expect(result?.vatRate).toBe(0.12);
  });

  it("returns null when the product has no list price", () => {
    expect(calculateUplift({ type: "cross_sell", product: product({ price: null }), quantity: 1 }, "EUR")).toBeNull();
  });

  it("never mixes currencies", () => {
    expect(calculateUplift({ type: "cross_sell", product: product(), quantity: 1 }, "SEK")).toBeNull();
    expect(calculateUplift({ type: "extension", lineItem: lineItem({ currency: "SEK" }), quantity: 1 }, "EUR")).toBeNull();
    expect(
      calculateUplift({ type: "upgrade", product: product(), lineItem: lineItem({ currency: "SEK" }), quantity: 1 }, "EUR"),
    ).toBeNull();
  });

  it("returns null when the proposal currency is unknown", () => {
    expect(calculateUplift({ type: "cross_sell", product: product(), quantity: 1 }, null)).toBeNull();
  });

  it("returns null for an extension of a line item without prices", () => {
    expect(calculateUplift({ type: "extension", lineItem: lineItem({ unitPriceExclVat: null }), quantity: 1 }, "EUR")).toBeNull();
  });

  it("returns null when an upgrade is not more expensive", () => {
    const cheaper = product({ price: { unitPriceExclVat: 14000, currency: "EUR", vatRate: 0.12, unit: "night", unitLabel: null } });
    expect(calculateUplift({ type: "upgrade", product: cheaper, lineItem: lineItem(), quantity: 40 }, "EUR")).toBeNull();
  });
});
