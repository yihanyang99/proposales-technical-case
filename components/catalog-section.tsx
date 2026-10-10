import { CategoryIcon } from "@/components/category-icon";
import { Alert, Badge, Card, SectionTitle } from "@/components/ui";
import {
  groupByCategory,
  proposalStatusByProduct,
  type CatalogProduct,
  type ProductPrice,
  type ProposalStatus,
} from "@/lib/catalog/model";
import type { ProductCategory } from "@/lib/catalog/rate-card";
import { getCatalog } from "@/lib/catalog/service";
import { formatMoney, formatPercent } from "@/lib/format";
import { describeError } from "@/lib/proposales/errors";

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  accommodation: "Accommodation",
  meeting_room: "Meeting room",
  food_and_beverage: "Food & beverage",
  package: "Package",
  other: "Other",
};

/** Unit as shown in Proposales. `unitLabel` is not displayed; it gives the AI context (Step 5). */
function formatUnit(price: ProductPrice): string {
  return `/ ${price.unit}`;
}

/** The hotel's catalog for a proposal's company, with list prices from the rate card. */
export async function CatalogSection({
  companyId,
  language,
  lineItems,
}: {
  companyId: number;
  language: string;
  /** The proposal's line items, to show which products are in it and how. */
  lineItems: { variationId: number | null; title: string; optional: boolean }[];
}) {
  let products: CatalogProduct[];
  let orphaned: { key: string; title: string }[];
  try {
    const catalog = await getCatalog(companyId, language);
    products = catalog.products;
    orphaned = catalog.orphanedRateCardEntries;
  } catch (error) {
    return (
      <section>
        <SectionTitle>Hotel catalog</SectionTitle>
        <Alert title="Could not load the product catalog">{describeError(error)}</Alert>
      </section>
    );
  }

  const unpriced = products.filter((p) => !p.price);
  const status = proposalStatusByProduct(products, lineItems);
  return (
    <section className="space-y-4">
      <SectionTitle className="mb-0">Hotel catalog</SectionTitle>
      {unpriced.length > 0 && (
        <Alert tone="neutral" title={`${unpriced.length} ${unpriced.length === 1 ? "product has" : "products have"} no list price`}>
          They are not in the rate card, so they are shown but can&apos;t be priced in recommendations.
        </Alert>
      )}
      {orphaned.length > 0 && (
        <Alert tone="neutral" title="Rate card entries without a live product">
          {orphaned.map((entry) => entry.title).join(", ")}. Re-generate the rate card with{" "}
          <code>npm run seed -- --rate-card</code>.
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {groupByCategory(products).map(({ category, products: group }) => (
          <Card key={category ?? "uncategorised"} className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-medium">
              <CategoryIcon category={category} />
              {category ? CATEGORY_LABEL[category] : "Not in rate card"}
            </h3>
            <ul className="space-y-3">
              {group.map((product) => (
                <ProductRow key={product.variationId} product={product} status={status.get(product.variationId)} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted">
        List prices exclude VAT and come from the app rate card, because the Proposales API does not expose catalog prices.
      </p>
    </section>
  );
}

const STATUS_LABEL: Record<ProposalStatus, string> = {
  included: "In proposal",
  included_with_extension: "In proposal · extension offered",
  optional: "Optional extra",
  optional_upgrade: "Optional upgrade",
};

function ProductRow({ product, status }: { product: CatalogProduct; status: ProposalStatus | undefined }) {
  return (
    <li className="flex items-baseline justify-between gap-4 text-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body">{product.title}</p>
          {status && <Badge tone={status === "included" || status === "included_with_extension" ? "strong" : "neutral"}>{STATUS_LABEL[status]}</Badge>}
        </div>
        {product.price && <p className="mt-0.5 text-xs text-muted">{formatPercent(product.price.vatRate)} VAT</p>}
      </div>
      <p className="shrink-0 whitespace-nowrap text-right tabular-nums">
        {product.price ? (
          <>
            <span className="text-body">{formatMoney(product.price.unitPriceExclVat, product.price.currency)}</span>{" "}
            <span className="text-muted">{formatUnit(product.price)}</span>
          </>
        ) : (
          <span className="text-muted">Price unavailable</span>
        )}
      </p>
    </li>
  );
}
