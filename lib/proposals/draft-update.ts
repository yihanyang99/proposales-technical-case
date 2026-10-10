import { upgradeSupplementTitle, type CatalogProduct } from "@/lib/catalog/model";
import type { RawBlock } from "@/lib/proposales/schemas";
import type { RecommendationType } from "@/lib/recommendations/model";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/revenue/simulation";
import { withVat } from "@/lib/revenue/uplift";
import type { LineItem } from "./model";

// Pure planning for "Update draft in Proposales". What the customer already has never changes:
// existing blocks are re-sent untouched, and every opportunity is added as an optional block the
// customer can pick. Prices are re-derived on the server from the rate card and the fresh
// proposal, never taken from the browser.

/** What the browser asks for: which opportunity, and the quantity the salesperson chose. */
export type DraftItem = { type: RecommendationType; productId: number; lineItemId: string | null; quantity: number };

/** One optional block to add. An upgrade is added as a supplement product priced at the difference. */
export type DraftChange = {
  type: RecommendationType;
  /** Content to add; for an upgrade, the supplement (resolved or created on the server). */
  contentId: number | null;
  title: string;
  quantity: number;
  unitPriceExclVat: number;
  unitPriceInclVat: number;
  /** Upgrade only: the rooms (or other line) being upgraded, and the product they upgrade to. */
  upgrade: { from: LineItem; to: CatalogProduct } | null;
};

export type DraftPlanError =
  | "not_a_draft"
  | "unknown_product"
  | "unknown_line_item"
  | "already_in_proposal"
  | "line_item_mismatch"
  | "price_unavailable"
  | "currency_mismatch"
  | "invalid_quantity"
  | "not_an_upgrade"
  | "conflicting_changes";

/** Block fields the update accepts (ProposalBlockInput). title, description and image_uuids are ignored on update. */
const BLOCK_INPUT_FIELDS = [
  "uuid",
  "type",
  "content_id",
  "video_url",
  "currency",
  "quantity",
  "quantity_editable",
  "optional",
  "package_split",
  "multi_product_enabled",
  "multi_product_data",
  "unit_value_with_discount_with_tax",
  "unit_value_with_discount_without_tax",
  "unit_value_without_discount_with_tax",
  "unit_value_without_discount_without_tax",
] as const;

/** An existing block as update input, unchanged (its uuid keeps the editor's own changes). */
export function toBlockInput(block: RawBlock): Record<string, unknown> {
  return Object.fromEntries(BLOCK_INPUT_FIELDS.filter((field) => block[field] != null).map((field) => [field, block[field]]));
}

/** Checks each requested item against the catalog and the freshly fetched proposal. */
export function planDraftChanges(
  items: DraftItem[],
  context: { status: string; currency: string | null; catalog: CatalogProduct[]; lineItems: LineItem[] },
): { changes: DraftChange[] } | { error: DraftPlanError } {
  if (context.status !== "draft") return { error: "not_a_draft" };
  const products = new Map(context.catalog.map((p) => [p.variationId, p]));
  const lines = new Map(context.lineItems.map((l) => [l.id, l]));
  const inProposal = new Set(context.lineItems.map((l) => l.variationId));
  const upgraded = new Set<string>();
  const changes: DraftChange[] = [];

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) return { error: "unknown_product" };
    if (!Number.isInteger(item.quantity) || item.quantity < MIN_QUANTITY || item.quantity > MAX_QUANTITY) {
      return { error: "invalid_quantity" };
    }

    if (item.type === "cross_sell") {
      if (inProposal.has(product.variationId)) return { error: "already_in_proposal" };
      if (!product.price) return { error: "price_unavailable" };
      if (product.price.currency !== context.currency) return { error: "currency_mismatch" };
      changes.push({
        type: "cross_sell",
        contentId: product.variationId,
        title: product.title,
        quantity: item.quantity,
        unitPriceExclVat: product.price.unitPriceExclVat,
        unitPriceInclVat: withVat(product.price.unitPriceExclVat, product.price.vatRate),
        upgrade: null,
      });
      continue;
    }

    const lineItem = item.lineItemId ? lines.get(item.lineItemId) : undefined;
    if (!lineItem) return { error: "unknown_line_item" };
    if (lineItem.unitPriceExclVat === null || lineItem.unitPriceInclVat === null) return { error: "price_unavailable" };
    if (lineItem.currency !== context.currency) return { error: "currency_mismatch" };

    if (item.type === "extension") {
      if (lineItem.variationId !== product.variationId) return { error: "line_item_mismatch" };
      // An extra night or day at the price already agreed in the proposal.
      changes.push({
        type: "extension",
        contentId: product.variationId,
        title: product.title,
        quantity: item.quantity,
        unitPriceExclVat: lineItem.unitPriceExclVat,
        unitPriceInclVat: lineItem.unitPriceInclVat,
        upgrade: null,
      });
      continue;
    }

    if (lineItem.variationId === product.variationId) return { error: "line_item_mismatch" };
    if (upgraded.has(lineItem.id)) return { error: "conflicting_changes" };
    if (!product.price) return { error: "price_unavailable" };
    if (product.price.currency !== context.currency) return { error: "currency_mismatch" };
    const exclVat = product.price.unitPriceExclVat - lineItem.unitPriceExclVat;
    const inclVat = withVat(product.price.unitPriceExclVat, product.price.vatRate) - lineItem.unitPriceInclVat;
    if (exclVat <= 0 || inclVat <= 0) return { error: "not_an_upgrade" };
    upgraded.add(lineItem.id);
    changes.push({
      type: "upgrade",
      contentId: null,
      title: upgradeSupplementTitle(lineItem.title, product.title),
      // The supplement covers every booked unit of the upgraded line.
      quantity: lineItem.quantity ?? item.quantity,
      unitPriceExclVat: exclVat,
      unitPriceInclVat: inclVat,
      upgrade: { from: lineItem, to: product },
    });
  }
  return { changes };
}

/**
 * The complete, ordered block list to send: every existing block unchanged, then one optional
 * block per change, whose quantity the customer can adjust. Every change must have its content
 * id resolved by then.
 */
export function buildDraftBlocks(blocks: RawBlock[], changes: (DraftChange & { contentId: number })[], currency: string): Record<string, unknown>[] {
  return [
    ...blocks.map(toBlockInput),
    ...changes.map((change) => ({
      type: "product-block",
      content_id: change.contentId,
      currency,
      quantity: change.quantity,
      quantity_editable: true,
      optional: true,
      unit_value_without_discount_without_tax: change.unitPriceExclVat,
      unit_value_without_discount_with_tax: change.unitPriceInclVat,
      unit_value_with_discount_without_tax: change.unitPriceExclVat,
      unit_value_with_discount_with_tax: change.unitPriceInclVat,
    })),
  ];
}
