// Seeds the Proposales test account with hotel products and draft proposals (Step 2a).
//
//   npm run seed                          dry run: prints what would be created, writes nothing
//   npm run seed -- --only=board-meeting  limit to some proposals (and the products they use)
//   npm run seed -- --apply               performs the writes (requires explicit approval)
//   npm run seed -- --rate-card           regenerates data/rate-card.json from existing products (read-only)
//
// Idempotent: products are matched by title, proposals by data.seed_key. Existing items are
// reused, never modified. Proposals are created as drafts without recipients and are never sent.
// Runs with the react-server condition so `server-only` modules (env, client) can be imported.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getServerEnv } from "@/lib/env";
import {
  getProposal,
  listCompanies,
  listContent,
  searchProposals,
} from "@/lib/proposales/client";
import {
  SEED_CURRENCY,
  SEED_LANGUAGE,
  seedProducts,
  seedProposals,
  type SeedProduct,
} from "./seed-data";

const BASE_URL = "https://api.proposales.com";
const RATE_CARD_PATH = "data/rate-card.json";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const rateCardOnly = args.includes("--rate-card");
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length).split(",");
// A block's content_id is the content library variation_id (verified live 2026-10-09).
const contentIdField = "variation_id";

type ContentIds = { product_id: number; variation_id: number };

async function post(path: string, body: unknown): Promise<unknown> {
  const { PROPOSALES_API_KEY } = getServerEnv();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PROPOSALES_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`POST ${path} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

const withVat = (minor: number, rate: number) => Math.round(minor * (1 + rate));

function productBlock(product: SeedProduct, ids: ContentIds | undefined, quantity: number) {
  const excl = product.unitPriceExclVat;
  const incl = withVat(excl, product.vatRate);
  return {
    type: "product-block",
    content_id: ids ? ids[contentIdField] : `<new ${product.key}>`,
    currency: SEED_CURRENCY,
    quantity,
    unit_value_without_discount_without_tax: excl,
    unit_value_without_discount_with_tax: incl,
    unit_value_with_discount_without_tax: excl,
    unit_value_with_discount_with_tax: incl,
  };
}

// Rate card: prices live in the app because the catalog API has none (see API_FINDINGS.md).
function writeRateCard(idsByKey: Map<string, ContentIds>) {
  const rateCard = {
    currency: SEED_CURRENCY,
    vatBasis: "excluded",
    priceUnit: "minor",
    products: seedProducts
      .filter((p) => idsByKey.has(p.key))
      .map((p) => {
        const { product_id, variation_id } = idsByKey.get(p.key)!;
        return {
          product_id,
          variation_id,
          key: p.key,
          title: p.title,
          category: p.category,
          unit: p.unit,
          ...(p.unitLabel ? { unitLabel: p.unitLabel } : {}),
          unitPrice: p.unitPriceExclVat,
          vatRate: p.vatRate,
        };
      }),
  };
  mkdirSync(dirname(RATE_CARD_PATH), { recursive: true });
  writeFileSync(RATE_CARD_PATH, JSON.stringify(rateCard, null, 2) + "\n");
  console.log(`\nWrote ${RATE_CARD_PATH} (${rateCard.products.length} products)`);
}

async function main() {
  if (apply && rateCardOnly) throw new Error("Use either --apply or --rate-card, not both");
  console.log(`Mode: ${apply ? "APPLY (writes to Proposales)" : rateCardOnly ? "RATE CARD (read-only, writes a local file)" : "DRY RUN (no writes)"}\n`);

  const companies = await listCompanies();
  if (companies.length !== 1) throw new Error(`Expected exactly one company, found ${companies.length}`);
  const company = companies[0];
  if (company.currency !== SEED_CURRENCY) throw new Error(`Company currency is ${company.currency}, expected ${SEED_CURRENCY}`);

  const proposals = seedProposals.filter((p) => !only || only.includes(p.seedKey));
  const neededKeys = new Set(proposals.flatMap((p) => p.lines.map((l) => l.productKey)));
  const products = only ? seedProducts.filter((p) => neededKeys.has(p.key)) : seedProducts;

  // Products: reuse active content with the same English title, otherwise create.
  const existing = await listContent({ companyId: company.id });
  const idsByKey = new Map<string, ContentIds>();
  for (const product of products) {
    const match = existing.find((item) => item.title[SEED_LANGUAGE] === product.title);
    if (match) {
      idsByKey.set(product.key, match);
      console.log(`product  exists   ${product.title} (${match.product_id}/${match.variation_id})`);
      continue;
    }
    const payload = { company_id: company.id, language: SEED_LANGUAGE, title: product.title, description: product.description };
    if (!apply) {
      console.log(`product  CREATE   POST /v3/content ${JSON.stringify(payload)}`);
      continue;
    }
    const created = (await post("/v3/content", payload)) as { data: ContentIds };
    idsByKey.set(product.key, created.data);
    console.log(`product  created  ${product.title} (${created.data.product_id}/${created.data.variation_id})`);
  }

  if (rateCardOnly) {
    const missing = products.filter((p) => !idsByKey.has(p.key));
    if (missing.length) throw new Error(`Products not found in Proposales: ${missing.map((p) => p.title).join(", ")}. Run --apply first.`);
    writeRateCard(idsByKey);
    return;
  }

  // Proposals: reuse by data.seed_key, otherwise create as a draft.
  const created: string[] = [];
  for (const proposal of proposals) {
    const [match] = await searchProposals({ companyId: company.id, dataFilters: { seed_key: proposal.seedKey } });
    if (match) {
      console.log(`proposal exists   ${proposal.title} (${match.uuid})`);
      created.push(match.uuid);
      continue;
    }
    const payload = {
      company_id: company.id,
      language: SEED_LANGUAGE,
      title_md: proposal.title,
      description_md: proposal.description,
      data: proposal.data,
      blocks: proposal.lines.map((line) => {
        const product = seedProducts.find((p) => p.key === line.productKey);
        if (!product) throw new Error(`Unknown product key ${line.productKey}`);
        return productBlock(product, idsByKey.get(product.key), line.quantity);
      }),
    };
    if (!apply) {
      console.log(`proposal CREATE   POST /v3/proposals ${JSON.stringify(payload, null, 1)}`);
      continue;
    }
    const result = (await post("/v3/proposals", payload)) as { proposal: { uuid: string; url: string } };
    console.log(`proposal created  ${proposal.title} (${result.proposal.uuid}) ${result.proposal.url}`);
    created.push(result.proposal.uuid);
  }

  if (!apply) {
    console.log("\nDry run complete. Nothing was written.");
    return;
  }

  writeRateCard(idsByKey);

  // Read back what the API stored, to verify block linking, prices and tax handling.
  for (const uuid of created) {
    const p = await getProposal(uuid);
    console.log(`\nverify ${p.title} status=${p.status} currency=${p.currency} tax=${JSON.stringify(p.tax_options)} total_excl=${p.value_without_tax} total_incl=${p.value_with_tax}`);
    for (const b of p.blocks) {
      console.log(`  block content_id=${b.content_id} title=${JSON.stringify(b.title)} qty=${b.quantity} currency=${b.currency} excl=${b.unit_value_with_discount_without_tax} incl=${b.unit_value_with_discount_with_tax}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
