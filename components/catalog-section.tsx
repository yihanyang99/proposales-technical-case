import { CatalogBrowser } from "@/components/catalog-browser";
import { Alert, cardStyles, SectionTitle } from "@/components/ui";
import { proposalStatusByProduct, type CatalogProduct } from "@/lib/catalog/model";
import { getCatalog } from "@/lib/catalog/service";
import { cn } from "@/lib/cn";
import { describeError } from "@/lib/proposales/errors";

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
  const status = Object.fromEntries(proposalStatusByProduct(products, lineItems));
  return (
    <section>
      {/* One card, collapsed by default: mostly the AI's input, and long for a real hotel. Native <details>, so it works without JavaScript. */}
      <details className={cn(cardStyles(), "group")}>
        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-xl px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <SectionTitle className="mb-0">Hotel catalog</SectionTitle>
            <p className="mt-1 text-sm text-muted">
              {products.length} {products.length === 1 ? "product" : "products"} · what the AI chooses from
            </p>
          </div>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 text-muted transition-transform group-open:rotate-90">
            <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="space-y-6 px-5 pt-2 pb-5">
          {unpriced.length > 0 && (
            <Alert
              tone="neutral"
              variant="soft"
              title={`${unpriced.length} ${unpriced.length === 1 ? "product has" : "products have"} no list price`}
            >
              They are not in the rate card, so they are shown but can&apos;t be priced in recommendations.
            </Alert>
          )}
          {orphaned.length > 0 && (
            <Alert tone="neutral" variant="soft" title="Rate card entries without a live product">
              {orphaned.map((entry) => entry.title).join(", ")}. Re-generate the rate card with{" "}
              <code>npm run seed -- --rate-card</code>.
            </Alert>
          )}
          <CatalogBrowser products={products} status={status} />
          <p className="text-xs text-muted">List prices exclude VAT.</p>
        </div>
      </details>
    </section>
  );
}
