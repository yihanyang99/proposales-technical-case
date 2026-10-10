import type { ContentItem } from "@/lib/proposales/schemas";
import type { ProductCategory, ProductUnit, RateCard } from "./rate-card";

// Internal product model: Proposales content library items joined with the app rate card.
// Pure functions only.

export type ProductPrice = {
  /** Minor units (cents), excluding VAT. */
  unitPriceExclVat: number;
  currency: string;
  vatRate: number;
  unit: ProductUnit;
  /** What one "unit" means when the unit list has no exact match, e.g. "half-day session". */
  unitLabel: string | null;
};

export type CatalogProduct = {
  productId: number;
  /** What proposal blocks reference as content_id. */
  variationId: number;
  title: string;
  description: string | null;
  category: ProductCategory | null;
  /** null = no rate-card entry: "price unavailable", never treated as 0. */
  price: ProductPrice | null;
};

export type Catalog = {
  products: CatalogProduct[];
  /** Rate-card entries whose product is not in the live catalog (deleted, archived, other account). */
  orphanedRateCardEntries: { key: string; title: string; variationId: number }[];
};

const UNTITLED = "Untitled product";

/** Picks the text in the requested language, then English, then any available language. */
export function pickLocalized(text: Record<string, string>, language: string): string | null {
  const value = text[language] ?? text.en ?? Object.values(text)[0];
  return value?.trim() || null;
}

const SUPPLEMENT_PREFIX = "Upgrade: ";

/**
 * Library title of the product that upgrades one item to another (e.g. a room type), added to a
 * proposal as an optional extra priced at the difference. Shown to the customer.
 */
export function upgradeSupplementTitle(fromTitle: string, toTitle: string): string {
  return `${SUPPLEMENT_PREFIX}${fromTitle} → ${toTitle}`;
}

/** Upgrade supplements only exist to carry an upgrade in a proposal, so the catalog and the AI never see them. */
export function isUpgradeSupplement(title: string): boolean {
  return title.startsWith(SUPPLEMENT_PREFIX) && title.includes(" → ");
}

export function joinCatalog(items: ContentItem[], card: RateCard, language: string): Catalog {
  const entries = new Map(card.products.map((entry) => [entry.variation_id, entry]));
  const offered = items.filter((item) => !isUpgradeSupplement(pickLocalized(item.title, language) ?? ""));
  const products = offered.map((item): CatalogProduct => {
    const entry = entries.get(item.variation_id);
    return {
      productId: item.product_id,
      variationId: item.variation_id,
      title: pickLocalized(item.title, language) ?? UNTITLED,
      description: pickLocalized(item.description, language),
      category: entry?.category ?? null,
      price: entry
        ? {
            unitPriceExclVat: entry.unitPrice,
            currency: card.currency,
            vatRate: entry.vatRate,
            unit: entry.unit,
            unitLabel: entry.unitLabel ?? null,
          }
        : null,
    };
  });

  const live = new Set(items.map((item) => item.variation_id));
  const orphanedRateCardEntries = card.products
    .filter((entry) => !live.has(entry.variation_id))
    .map((entry) => ({ key: entry.key, title: entry.title, variationId: entry.variation_id }));

  return { products, orphanedRateCardEntries };
}

const CATEGORY_ORDER: (ProductCategory | null)[] = ["accommodation", "meeting_room", "food_and_beverage", "package", "other", null];

/** Groups products by category in a fixed, sales-friendly order; unpriced (uncategorised) last. */
export function groupByCategory(products: CatalogProduct[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    products: products.filter((p) => p.category === category).sort((a, b) => a.title.localeCompare(b.title)),
  })).filter((group) => group.products.length > 0);
}
