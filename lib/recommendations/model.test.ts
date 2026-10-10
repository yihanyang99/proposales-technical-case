import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog/model";
import type { LineItem } from "@/lib/proposals/model";
import { describeExtension, quantityLabel, validateRecommendations, type ModelOutput } from "./model";

const priced = (variationId: number, title: string, category: CatalogProduct["category"], unitPrice: number): CatalogProduct => ({
  productId: variationId + 1000,
  variationId,
  title,
  description: null,
  category,
  price: { unitPriceExclVat: unitPrice, currency: "EUR", vatRate: 0.12, unit: "night", unitLabel: null },
});

const catalog = [
  priced(1, "Standard Double Room", "accommodation", 14500),
  priced(2, "Superior Double Room", "accommodation", 18500),
  priced(3, "Coffee Break", "food_and_beverage", 900),
  priced(4, "Spa Access", "other", 3500),
  priced(5, "Business Lunch", "food_and_beverage", 3200),
  priced(6, "Junior Suite", "accommodation", 26000),
  priced(7, "Three-Course Dinner", "food_and_beverage", 5800),
];

const roomLine: LineItem = {
  id: "line-room",
  variationId: 1,
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
};
const lunchLine: LineItem = { ...roomLine, id: "line-lunch", variationId: 5, title: "Business Lunch", quantity: 160, unitPriceExclVat: 3200 };

type Raw = ModelOutput["recommendations"][number];
const raw = (overrides: Partial<Raw>): Raw => ({
  type: "cross_sell",
  productId: 3,
  lineItemId: null,
  quantity: 80,
  quantityRationale: "80 guests",
  explanation: "Fits the event.",
  confidence: "high",
  conflictsWith: [],
  ...overrides,
});

const run = (recommendations: Raw[]) => validateRecommendations({ recommendations }, { catalog, lineItems: [roomLine, lunchLine] });

describe("validateRecommendations", () => {
  it("keeps valid cross-sells, upgrades and extensions", () => {
    const { recommendations, dropped } = run([
      raw({}),
      raw({ type: "upgrade", productId: 2, lineItemId: "line-room", quantity: 40 }),
      raw({ type: "extension", productId: 1, lineItemId: "line-room", quantity: 20, quantityRationale: "20 rooms" }),
    ]);
    expect(recommendations.map((r) => r.type)).toEqual(["cross_sell", "upgrade", "extension"]);
    expect(dropped).toEqual([]);
  });

  it.each([
    ["unknown_product", raw({ productId: 999 })],
    ["already_in_proposal", raw({ productId: 5 })],
    ["unknown_line_item", raw({ type: "upgrade", productId: 2, lineItemId: "nope" })],
    ["line_item_mismatch", raw({ type: "extension", productId: 3, lineItemId: "line-room" })],
    ["line_item_mismatch", raw({ type: "upgrade", productId: 1, lineItemId: "line-room" })],
    ["category_mismatch", raw({ type: "upgrade", productId: 4, lineItemId: "line-room" })],
    ["not_an_upgrade", raw({ type: "upgrade", productId: 3, lineItemId: "line-lunch" })],
    ["invalid_quantity", raw({ quantity: 2.5 })],
    ["invalid_quantity", raw({ quantity: 0 })],
    ["invalid_quantity", raw({ quantity: 10_001 })],
    ["missing_explanation", raw({ explanation: "   " })],
  ] as const)("drops %s", (reason, recommendation) => {
    const { recommendations, dropped } = run([recommendation]);
    expect(recommendations).toEqual([]);
    expect(dropped).toEqual([{ index: 0, reason }]);
  });

  it("forces an upgrade's quantity to the line item's quantity", () => {
    const { recommendations } = run([raw({ type: "upgrade", productId: 2, lineItemId: "line-room", quantity: 999 })]);
    expect(recommendations[0].quantity).toBe(40);
  });

  it("drops duplicates and anything beyond three", () => {
    const { recommendations, dropped } = run([
      raw({}),
      raw({}),
      raw({ type: "upgrade", productId: 2, lineItemId: "line-room" }),
      raw({ type: "extension", productId: 1, lineItemId: "line-room", quantity: 1 }),
      raw({ type: "extension", productId: 5, lineItemId: "line-lunch", quantity: 1 }),
    ]);
    expect(recommendations).toHaveLength(3);
    expect(dropped).toEqual([
      { index: 1, reason: "duplicate" },
      { index: 4, reason: "over_limit" },
    ]);
  });

  it("returns an empty result for empty model output", () => {
    expect(run([])).toEqual({ recommendations: [], dropped: [] });
  });
});

describe("conflicts", () => {
  const conflictsOf = (recommendations: Raw[]) =>
    Object.fromEntries(run(recommendations).recommendations.map((r) => [r.id, r.conflictsWith]));

  it("links two upgrades of the same line item, even when the model misses it", () => {
    expect(
      conflictsOf([
        raw({ type: "upgrade", productId: 2, lineItemId: "line-room" }),
        raw({ type: "upgrade", productId: 6, lineItemId: "line-room" }),
      ]),
    ).toEqual({ "upgrade:2:line-room": ["upgrade:6:line-room"], "upgrade:6:line-room": ["upgrade:2:line-room"] });
  });

  it("links an upgrade and a cross-sell of the same product", () => {
    expect(
      conflictsOf([raw({ type: "upgrade", productId: 2, lineItemId: "line-room" }), raw({ productId: 2, quantity: 5 })]),
    ).toEqual({ "upgrade:2:line-room": ["cross_sell:2:"], "cross_sell:2:": ["upgrade:2:line-room"] });
  });

  it("makes the model's conflicts symmetric", () => {
    expect(conflictsOf([raw({ productId: 3 }), raw({ productId: 7, conflictsWith: [0] })])).toEqual({
      "cross_sell:3:": ["cross_sell:7:"],
      "cross_sell:7:": ["cross_sell:3:"],
    });
  });

  it("ignores conflicts with itself, dropped or unknown suggestions", () => {
    expect(
      conflictsOf([raw({ productId: 3, conflictsWith: [0, 1, 99, -1, 0.5] }), raw({ productId: 999 }), raw({ productId: 7 })]),
    ).toEqual({ "cross_sell:3:": [], "cross_sell:7:": [] });
  });

  it("keeps an upgrade and an extension of the same line combinable", () => {
    expect(
      conflictsOf([
        raw({ type: "upgrade", productId: 2, lineItemId: "line-room" }),
        raw({ type: "extension", productId: 1, lineItemId: "line-room", quantity: 20 }),
      ]),
    ).toEqual({ "upgrade:2:line-room": [], "extension:1:line-room": [] });
  });
});

describe("quantityLabel", () => {
  it.each([
    ["80 guests × 2 days", 160, "80 guests × 2 days"],
    ["80 guests x 2 days", 160, "80 guests × 2 days"],
    ["80 guests * 2 days", 160, "80 guests × 2 days"],
    ["40 rooms", 40, "40 rooms"],
    ["20 extra rooms", 20, "20 extra rooms"],
  ])("accepts %j for %i", (expression, quantity, expected) => {
    expect(quantityLabel(expression, quantity)).toBe(expected);
  });

  it.each([
    ["80 guests × 2 days", 150],
    ["80 attendees × 2 days for coffee breaks", 160],
    ["two days", 2],
    ["40 rooms (1 night)", 40],
    ["", 5],
  ])("rejects %j for %i", (expression, quantity) => {
    expect(quantityLabel(expression, quantity)).toBeNull();
  });
});

describe("describeExtension", () => {
  it("spells out rooms × nights for room-night quantities", () => {
    expect(describeExtension(20, "night", "20 rooms × 1 night")).toBe("by 1 night for 20 rooms");
    expect(describeExtension(40, "night", "20 rooms × 2 nights")).toBe("by 2 nights for 20 rooms");
    expect(describeExtension(1, "night", "1 room × 1 night")).toBe("by 1 night for 1 room");
  });

  it("uses a single matching term for day-priced items", () => {
    expect(describeExtension(1, "day", "1 day")).toBe("by 1 day");
    expect(describeExtension(2, "day", "2 days")).toBe("by 2 days");
  });

  it("falls back to plain units without a usable breakdown", () => {
    expect(describeExtension(20, "night", null)).toBe("(20 room-nights)");
    expect(describeExtension(1, "night", null)).toBe("(1 room-night)");
    expect(describeExtension(20, "night", "20 rooms")).toBe("(20 room-nights)");
    expect(describeExtension(3, "day", null)).toBe("by 3 days");
    expect(describeExtension(5, "person", "5 guests")).toBe("(5 × person)");
  });
});
