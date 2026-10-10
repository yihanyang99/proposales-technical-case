import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog/model";
import type { RawBlock } from "@/lib/proposales/schemas";
import { buildDraftBlocks, planDraftChanges, toBlockInput, type DraftItem } from "./draft-update";
import type { LineItem } from "./model";

const product = (variationId: number, title: string, unitPriceExclVat: number | null, vatRate = 0.12): CatalogProduct => ({
  productId: variationId - 10,
  variationId,
  title,
  description: null,
  category: "accommodation",
  price: unitPriceExclVat === null ? null : { unitPriceExclVat, currency: "EUR", vatRate, unit: "night", unitLabel: null },
});

const catalog = [
  product(190482, "Standard Double Room", 14500),
  product(190483, "Superior Double Room", 18500),
  product(190481, "Coffee Break", 900),
  product(190499, "Unpriced", null),
];

const roomBlock: RawBlock = {
  uuid: "block-room",
  type: "product-block",
  content_id: 190482,
  title: "Standard Double Room",
  currency: "EUR",
  quantity: 40,
  language: "en",
  inventory_connected: false,
  package_split: [{ vat: 0, type: "other", fixed: false, value_with_tax: 0, enable_discount: true, value_without_tax: 0 }],
  unit_value_with_discount_with_tax: 16240,
  unit_value_with_discount_without_tax: 14500,
  unit_value_without_discount_with_tax: 16240,
  unit_value_without_discount_without_tax: 14500,
};
const videoBlock: RawBlock = { uuid: "block-video", type: "video-block", video_url: "https://example.com/v" };

const roomLine: LineItem = {
  id: "block-room",
  variationId: 190482,
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

const context = { status: "draft", currency: "EUR", catalog, lineItems: [roomLine] };
const plan = (items: DraftItem[], overrides: Partial<typeof context> = {}) => planDraftChanges(items, { ...context, ...overrides });

describe("toBlockInput", () => {
  it("re-sends an existing block with its uuid and every input field, untouched", () => {
    expect(toBlockInput(roomBlock)).toEqual({
      uuid: "block-room",
      type: "product-block",
      content_id: 190482,
      currency: "EUR",
      quantity: 40,
      package_split: roomBlock.package_split,
      unit_value_with_discount_with_tax: 16240,
      unit_value_with_discount_without_tax: 14500,
      unit_value_without_discount_with_tax: 16240,
      unit_value_without_discount_without_tax: 14500,
    });
  });
});

describe("planDraftChanges", () => {
  it("prices a cross-sell from the rate card and an extension at the proposal's own price", () => {
    const result = plan([
      { type: "cross_sell", productId: 190481, lineItemId: null, quantity: 80 },
      { type: "extension", productId: 190482, lineItemId: "block-room", quantity: 20 },
    ]);
    expect(result).toMatchObject({
      changes: [
        { type: "cross_sell", contentId: 190481, quantity: 80, unitPriceExclVat: 900, unitPriceInclVat: 1008, upgrade: null },
        { type: "extension", contentId: 190482, quantity: 20, unitPriceExclVat: 14500, unitPriceInclVat: 16240, upgrade: null },
      ],
    });
  });

  it("turns an upgrade into a supplement for every booked unit, priced at the difference", () => {
    const result = plan([{ type: "upgrade", productId: 190483, lineItemId: "block-room", quantity: 40 }]);
    expect(result).toMatchObject({
      changes: [
        {
          type: "upgrade",
          contentId: null,
          title: "Upgrade: Standard Double Room → Superior Double Room",
          quantity: 40,
          unitPriceExclVat: 4000,
          unitPriceInclVat: 20720 - 16240,
        },
      ],
    });
  });

  it.each([
    ["not_a_draft", [{ type: "cross_sell", productId: 190481, lineItemId: null, quantity: 1 }], { status: "sent" }],
    ["unknown_product", [{ type: "cross_sell", productId: 1, lineItemId: null, quantity: 1 }], {}],
    ["already_in_proposal", [{ type: "cross_sell", productId: 190482, lineItemId: null, quantity: 1 }], {}],
    ["price_unavailable", [{ type: "cross_sell", productId: 190499, lineItemId: null, quantity: 1 }], {}],
    ["currency_mismatch", [{ type: "cross_sell", productId: 190481, lineItemId: null, quantity: 1 }], { currency: "SEK" }],
    ["unknown_line_item", [{ type: "upgrade", productId: 190483, lineItemId: "gone", quantity: 40 }], {}],
    ["line_item_mismatch", [{ type: "extension", productId: 190481, lineItemId: "block-room", quantity: 1 }], {}],
    ["not_an_upgrade", [{ type: "upgrade", productId: 190481, lineItemId: "block-room", quantity: 40 }], {}],
    ["invalid_quantity", [{ type: "cross_sell", productId: 190481, lineItemId: null, quantity: 0 }], {}],
    [
      "conflicting_changes",
      [
        { type: "upgrade", productId: 190483, lineItemId: "block-room", quantity: 40 },
        { type: "upgrade", productId: 190483, lineItemId: "block-room", quantity: 40 },
      ],
      {},
    ],
  ] as const)("refuses %s", (error, items, overrides) => {
    expect(plan([...items], overrides)).toEqual({ error });
  });
});

describe("buildDraftBlocks", () => {
  it("keeps every existing block untouched and appends each opportunity as an optional block with a flexible quantity", () => {
    const result = plan([
      { type: "upgrade", productId: 190483, lineItemId: "block-room", quantity: 40 },
      { type: "cross_sell", productId: 190481, lineItemId: null, quantity: 80 },
    ]);
    if (!("changes" in result)) throw new Error("expected changes");
    const resolved = result.changes.map((change) => ({ ...change, contentId: change.contentId ?? 190600 }));
    expect(buildDraftBlocks([videoBlock, roomBlock], resolved, "EUR")).toEqual([
      { uuid: "block-video", type: "video-block", video_url: "https://example.com/v" },
      toBlockInput(roomBlock),
      {
        type: "product-block",
        content_id: 190600,
        currency: "EUR",
        quantity: 40,
        quantity_editable: true,
        optional: true,
        unit_value_without_discount_without_tax: 4000,
        unit_value_without_discount_with_tax: 4480,
        unit_value_with_discount_without_tax: 4000,
        unit_value_with_discount_with_tax: 4480,
      },
      {
        type: "product-block",
        content_id: 190481,
        currency: "EUR",
        quantity: 80,
        quantity_editable: true,
        optional: true,
        unit_value_without_discount_without_tax: 900,
        unit_value_without_discount_with_tax: 1008,
        unit_value_with_discount_without_tax: 900,
        unit_value_with_discount_with_tax: 1008,
      },
    ]);
  });

  it("re-sends the existing blocks unchanged when nothing is added", () => {
    expect(buildDraftBlocks([roomBlock], [], "EUR")).toEqual([toBlockInput(roomBlock)]);
  });
});
