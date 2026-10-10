"use client";

import { useState } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { Badge, ChoiceChip, ChoiceGroup, FieldLabel, SearchInput } from "@/components/ui";
import { groupByCategory, type CatalogProduct, type ProductPrice, type ProposalStatus } from "@/lib/catalog/model";
import type { ProductCategory } from "@/lib/catalog/rate-card";
import { formatMoney, formatPercent } from "@/lib/format";

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  accommodation: "Accommodation",
  meeting_room: "Meeting room",
  food_and_beverage: "Food & beverage",
  package: "Package",
  other: "Other",
};

const STATUS_LABEL: Record<ProposalStatus, string> = {
  included: "In proposal",
  included_with_extension: "In proposal · extension offered",
  optional: "Optional extra",
  optional_upgrade: "Optional upgrade",
};

/** Unit as shown in Proposales. `unitLabel` is not displayed; it gives the AI context (Step 5). */
function formatUnit(price: ProductPrice): string {
  return `/ ${price.unit}`;
}

const UNCATEGORISED = "none";

/** Searchable, filterable product list. Filters in the browser; the data comes from the server. */
export function CatalogBrowser({ products, status }: { products: CatalogProduct[]; status: Record<number, ProposalStatus> }) {
  const [query, setQuery] = useState("");
  /** Selected categories; none selected means all. */
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const categories = groupByCategory(products).map((group) => ({ key: group.category ?? UNCATEGORISED, ...group }));
  const needle = query.trim().toLowerCase();
  const visible = products.filter(
    (product) =>
      (selected.size === 0 || selected.has(product.category ?? UNCATEGORISED)) &&
      (!needle || product.title.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ChoiceGroup legend="Filter by category" hideLegend>
          <ChoiceChip type="checkbox" name="catalog-category" value="all" checked={selected.size === 0} onChange={() => setSelected(new Set())}>
            All
            <span className="ml-1.5 tabular-nums opacity-70">{products.length}</span>
          </ChoiceChip>
          {categories.map((group) => (
            <ChoiceChip
              key={group.key}
              type="checkbox"
              name="catalog-category"
              value={group.key}
              checked={selected.has(group.key)}
              onChange={() => toggle(group.key)}
            >
              {group.category ? CATEGORY_LABEL[group.category] : "Not in rate card"}
              <span className="ml-1.5 tabular-nums opacity-70">{group.products.length}</span>
            </ChoiceChip>
          ))}
        </ChoiceGroup>
        <div className="sm:w-72">
          <FieldLabel htmlFor="catalog-search">Search products</FieldLabel>
          <SearchInput
            id="catalog-search"
            variant="soft"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No products match your search.</p>
      ) : (
        <div className="divide-y divide-divider">
          {groupByCategory(visible).map(({ category: group, products: items }) => (
            <section key={group ?? UNCATEGORISED} className="py-6 first:pt-0 last:pb-0">
              <h3 className="mb-3 flex items-center gap-2 font-medium">
                <CategoryIcon category={group} />
                {group ? CATEGORY_LABEL[group] : "Not in rate card"}
              </h3>
              <ul className="space-y-3">
                {items.map((product) => (
                  <ProductRow key={product.variationId} product={product} status={status[product.variationId]} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

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
