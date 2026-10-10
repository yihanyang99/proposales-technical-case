import { z } from "zod";
import type { CatalogProduct } from "@/lib/catalog/model";
import type { LineItem } from "@/lib/proposals/model";
import { MAX_QUANTITY } from "@/lib/revenue/simulation";

export const RECOMMENDATION_TYPES = ["cross_sell", "upgrade", "extension"] as const;
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export const MAX_RECOMMENDATIONS = 3;

export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/**
 * What the model returns. Deliberately lenient (plain numbers, nullable strings): a single bad
 * suggestion is dropped by `validateRecommendations` instead of failing the whole response.
 * It contains no price fields, so the model cannot supply prices.
 */
export const modelOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      type: z.enum(RECOMMENDATION_TYPES),
      productId: z
        .number()
        .describe("Catalog product id to add (cross_sell), upgrade to (upgrade), or extend (extension)"),
      lineItemId: z
        .string()
        .nullable()
        .describe("Existing line item id for upgrade or extension; null for cross_sell"),
      quantity: z
        .number()
        .describe("Units to add (cross_sell, extension) or units of the replacement product (upgrade)"),
      quantityRationale: z
        .string()
        .describe("The quantity as a compact multiplication of event facts that equals `quantity`, e.g. '80 guests × 2 days' or '40 rooms'"),
      explanation: z.string().describe("1-2 sentences for the salesperson: why this fits this event"),
      confidence: z.enum(CONFIDENCE_LEVELS).describe("Qualitative fit, not a probability of conversion"),
      conflictsWith: z
        .array(z.number())
        .describe("0-based indices of other suggestions in this list that are alternatives to this one (only one of them would be included); empty if it combines with all others"),
    }),
  ),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

export type Recommendation = {
  id: string;
  type: RecommendationType;
  product: CatalogProduct;
  /** The line item being upgraded or extended; null for cross-sells. */
  lineItem: LineItem | null;
  quantity: number;
  /** Compact label for the quantity (e.g. "80 guests × 2 days"), only if its numbers multiply to `quantity`. */
  quantityLabel: string | null;
  explanation: string;
  confidence: Confidence;
  /** Ids of other recommendations that can't be included together with this one. */
  conflictsWith: string[];
};

export type DropReason =
  | "unknown_product"
  | "unknown_line_item"
  | "already_in_proposal"
  | "line_item_mismatch"
  | "not_an_upgrade"
  | "category_mismatch"
  | "invalid_quantity"
  | "missing_explanation"
  | "duplicate"
  | "over_limit";

/**
 * Accepts the model's quantity expression only when it is a plain product of numbered terms
 * ("80 guests × 2 days") whose numbers multiply to exactly `quantity`; otherwise null.
 */
export function quantityLabel(expression: string, quantity: number): string | null {
  const text = expression.trim().replace(/\s+/g, " ");
  if (!text || text.length > 60) return null;
  const terms = text.split(/\s*[×*]\s*|\s+x\s+/);
  let product = 1;
  for (const term of terms) {
    const match = /^(\d+(?:\.\d+)?)(?:\s+[\p{L}][\p{L}-]*){0,2}$/u.exec(term);
    if (!match) return null;
    product *= Number(match[1]);
  }
  return product === quantity ? terms.join(" × ") : null;
}

const plural = (count: number, word: string) => (count === 1 ? word : `${word}s`);

/**
 * How much an extension adds, in words. Uses the AI's verified breakdown when it is still valid
 * ("20 rooms × 1 night" → "by 1 night for 20 rooms"); otherwise falls back to plain units.
 */
export function describeExtension(quantity: number, unit: string | null, verifiedLabel: string | null): string {
  if (verifiedLabel) {
    const terms = verifiedLabel.split(" × ").map((term) => {
      const [count, ...words] = term.split(" ");
      return { count: Number(count), noun: words.join(" ").toLowerCase() };
    });
    const rooms = terms.find((t) => /^rooms?$/.test(t.noun));
    const nights = terms.find((t) => /^nights?$/.test(t.noun));
    if (unit === "night" && terms.length === 2 && rooms && nights) {
      return `by ${nights.count} ${plural(nights.count, "night")} for ${rooms.count} ${plural(rooms.count, "room")}`;
    }
    if (terms.length === 1 && unit && new RegExp(`^${unit}s?$`).test(terms[0].noun)) {
      return `by ${terms[0].count} ${plural(terms[0].count, unit)}`;
    }
  }
  if (unit === "night") return `(${quantity} room-${plural(quantity, "night")})`;
  if (unit === "day") return `by ${quantity} ${plural(quantity, "day")}`;
  return `(${quantity}${unit ? ` × ${unit}` : ""})`;
}

/**
 * Deterministic guardrails on model output. Keeps only suggestions that reference real catalog
 * products and line items, are internally consistent, and are not duplicates; caps at three.
 * Conflicts combine the model's judgement with structural rules (two upgrades of the same line
 * item, or an upgrade and a cross-sell of the same product) and are always symmetric.
 */
export function validateRecommendations(
  output: ModelOutput,
  context: { catalog: CatalogProduct[]; lineItems: LineItem[] },
): { recommendations: Recommendation[]; dropped: { index: number; reason: DropReason }[] } {
  const products = new Map(context.catalog.map((p) => [p.variationId, p]));
  const lines = new Map(context.lineItems.map((l) => [l.id, l]));
  const inProposal = new Set(context.lineItems.map((l) => l.variationId).filter((id) => id !== null));

  const recommendations: Recommendation[] = [];
  const dropped: { index: number; reason: DropReason }[] = [];
  const seen = new Set<string>();
  const idByIndex = new Map<number, string>();

  output.recommendations.forEach((raw, index) => {
    const drop = (reason: DropReason) => dropped.push({ index, reason });

    const product = products.get(raw.productId);
    if (!product) return drop("unknown_product");

    const explanation = raw.explanation.trim();
    if (!explanation) return drop("missing_explanation");

    let lineItem: LineItem | null = null;
    let quantity = raw.quantity;

    if (raw.type === "cross_sell") {
      if (inProposal.has(product.variationId)) return drop("already_in_proposal");
    } else {
      lineItem = raw.lineItemId ? (lines.get(raw.lineItemId) ?? null) : null;
      if (!lineItem) return drop("unknown_line_item");

      if (raw.type === "extension" && lineItem.variationId !== product.variationId) {
        return drop("line_item_mismatch");
      }
      if (raw.type === "upgrade") {
        if (lineItem.variationId === product.variationId) return drop("line_item_mismatch");
        const current = lineItem.variationId !== null ? products.get(lineItem.variationId) : undefined;
        if (current?.category && product.category && current.category !== product.category) {
          return drop("category_mismatch");
        }
        const replacementPrice = product.price?.unitPriceExclVat;
        if (replacementPrice === undefined || lineItem.unitPriceExclVat === null || replacementPrice <= lineItem.unitPriceExclVat) {
          return drop("not_an_upgrade");
        }
        // An upgrade replaces the existing units one for one.
        if (lineItem.quantity !== null) quantity = lineItem.quantity;
      }
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return drop("invalid_quantity");

    const key = `${product.variationId}:${lineItem?.id ?? ""}`;
    if (seen.has(key)) return drop("duplicate");
    if (recommendations.length >= MAX_RECOMMENDATIONS) return drop("over_limit");
    seen.add(key);

    const id = `${raw.type}:${key}`;
    idByIndex.set(index, id);
    recommendations.push({
      id,
      type: raw.type,
      product,
      lineItem,
      quantity,
      quantityLabel: quantityLabel(raw.quantityRationale, quantity),
      explanation: explanation.slice(0, 600),
      confidence: raw.confidence,
      conflictsWith: [],
    });
  });

  const conflicts = new Map(recommendations.map((r) => [r.id, new Set<string>()]));
  const link = (a: string, b: string) => {
    if (a === b) return;
    conflicts.get(a)?.add(b);
    conflicts.get(b)?.add(a);
  };
  output.recommendations.forEach((raw, index) => {
    const id = idByIndex.get(index);
    if (!id) return;
    for (const other of raw.conflictsWith) {
      const otherId = idByIndex.get(other);
      if (otherId) link(id, otherId);
    }
  });
  for (const a of recommendations) {
    for (const b of recommendations) {
      const sameLineUpgrades = a.type === "upgrade" && b.type === "upgrade" && a.lineItem?.id === b.lineItem?.id;
      const upgradeAndAdd = a.type === "upgrade" && b.type === "cross_sell" && a.product.variationId === b.product.variationId;
      if (sameLineUpgrades || upgradeAndAdd) link(a.id, b.id);
    }
  }

  return {
    recommendations: recommendations.map((r) => ({ ...r, conflictsWith: [...(conflicts.get(r.id) ?? [])] })),
    dropped,
  };
}
