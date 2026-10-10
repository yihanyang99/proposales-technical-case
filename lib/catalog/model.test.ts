import { describe, expect, it } from "vitest";
import type { ContentItem } from "@/lib/proposales/schemas";
import { groupByCategory, isUpgradeSupplement, joinCatalog, pickLocalized, proposalStatusByProduct, upgradeSupplementTitle } from "./model";
import type { RateCard } from "./rate-card";

const card: RateCard = {
  currency: "EUR",
  vatBasis: "excluded",
  priceUnit: "minor",
  products: [
    { product_id: 1, variation_id: 11, key: "room", title: "Room", category: "accommodation", unit: "night", unitPrice: 14500, vatRate: 0.12 },
    { product_id: 2, variation_id: 22, key: "gone", title: "Gone", category: "other", unit: "unit", unitPrice: 100, vatRate: 0.25 },
  ],
};

const item = (variation_id: number, title: Record<string, string>): ContentItem => ({
  product_id: variation_id - 10,
  variation_id,
  title,
  description: {},
  deactivated_at: null,
});

describe("joinCatalog", () => {
  it("prices products from the rate card by variation id", () => {
    const { products } = joinCatalog([item(11, { en: "Standard Room" })], card, "en");
    expect(products[0]).toMatchObject({
      variationId: 11,
      title: "Standard Room",
      category: "accommodation",
      price: { unitPriceExclVat: 14500, currency: "EUR", vatRate: 0.12, unit: "night", unitLabel: null },
    });
  });

  it("leaves products without a rate-card entry unpriced, never 0", () => {
    const { products } = joinCatalog([item(99, { en: "Mystery" })], card, "en");
    expect(products[0].price).toBeNull();
    expect(products[0].category).toBeNull();
  });

  it("reports rate-card entries without a live product", () => {
    const { orphanedRateCardEntries } = joinCatalog([item(11, { en: "Room" })], card, "en");
    expect(orphanedRateCardEntries).toEqual([{ key: "gone", title: "Gone", variationId: 22 }]);
  });

  it("uses a fallback title for untitled products", () => {
    expect(joinCatalog([item(11, {})], card, "en").products[0].title).toBe("Untitled product");
  });
});

describe("pickLocalized", () => {
  it("prefers the requested language, then English, then any language", () => {
    expect(pickLocalized({ sv: "Rum", en: "Room" }, "sv")).toBe("Rum");
    expect(pickLocalized({ en: "Room" }, "sv")).toBe("Room");
    expect(pickLocalized({ de: "Zimmer" }, "sv")).toBe("Zimmer");
  });

  it("treats blank text as missing", () => {
    expect(pickLocalized({ en: "   " }, "en")).toBeNull();
    expect(pickLocalized({}, "en")).toBeNull();
  });
});

describe("groupByCategory", () => {
  it("orders categories and puts uncategorised products last", () => {
    const { products } = joinCatalog([item(99, { en: "Mystery" }), item(11, { en: "Room" })], card, "en");
    expect(groupByCategory(products).map((group) => group.category)).toEqual(["accommodation", null]);
  });
});

describe("upgrade supplements", () => {
  it("are recognised by their title and hidden from the catalog", () => {
    const title = upgradeSupplementTitle("Standard Double Room", "Superior Double Room");
    expect(title).toBe("Upgrade: Standard Double Room → Superior Double Room");
    expect(isUpgradeSupplement(title)).toBe(true);
    expect(isUpgradeSupplement("Upgrade package")).toBe(false);
    const { products } = joinCatalog([item(11, { en: "Room" }), item(12, { en: title })], card, "en");
    expect(products.map((p) => p.title)).toEqual(["Room"]);
  });
});

describe("proposalStatusByProduct", () => {
  const { products } = joinCatalog(
    [item(11, { en: "Standard Room" }), item(12, { en: "Superior Room" }), item(13, { en: "Coffee Break" }), item(14, { en: "Spa" })],
    card,
    "en",
  );
  const line = (variationId: number, title: string, optional = false) => ({ variationId, title, optional });

  it("tells included lines, optional extras and offered upgrades apart", () => {
    const status = proposalStatusByProduct(products, [
      line(11, "Standard Room"),
      line(13, "Coffee Break", true),
      line(90, upgradeSupplementTitle("Standard Room", "Superior Room"), true),
    ]);
    expect(Object.fromEntries(status)).toEqual({ 11: "included", 13: "optional", 12: "optional_upgrade" });
  });

  it("lets an included line win over an optional one of the same product", () => {
    expect(proposalStatusByProduct(products, [line(13, "Coffee Break", true), line(13, "Coffee Break")]).get(13)).toBe("included");
  });
});
