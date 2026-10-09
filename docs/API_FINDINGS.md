# Proposales API Findings

Results of the Step 2 investigation (2026-10-09).

- OpenAPI specification: https://docs.proposales.com/openapi.json. This is the complete,
  machine-readable API contract (OpenAPI 3.0). It can be imported into API clients, code
  generators and agent tooling.
- Local snapshot: [`docs/proposales-openapi.json`](proposales-openapi.json) (OpenAPI 3.0.3,
  spec version `2026.09.02`, downloaded 2026-10-09, identical to upstream on 2026-10-09).
  Re-download it if the upstream spec changes. The live API is the final authority.
- Base URL: https://api.proposales.com (the only server listed in the spec).
- Authentication: Bearer token from the `PROPOSALES_API_KEY` environment variable (server-side only).
- Money: the spec states that *"all monetary values are represented in the smallest currency
  unit unless an operation states otherwise"* (e.g. cents). Not yet verified live, because
  the account has no priced data.

**Verification status values:**
- `Not yet verified.`
- `Verified (spec)`: confirmed in the OpenAPI specification only
- `Verified (live)`: confirmed with a real (read-only) API request
- `Unsupported`: confirmed as not available

> **Key finding:** the test account is **empty**. It has one company (`id 5500`, EUR,
> `tax_mode: standard`, created 2026-10-09) and no active products, proposals, templates or
> attachments. Two untitled products (190551, 190552) were created by accident in the
> Proposales UI during the investigation and then archived by the user. Live verification of response *fields* is therefore limited to companies
> and error responses. Proposal and product shapes are verified against the spec only,
> until test data exists.

---

## Authentication

- **Endpoint:** all endpoints except `POST /v1/inbox/{token}`, which is public.
- **Request parameters:** header `Authorization: Bearer <PROPOSALES_API_KEY>`.
- **Response fields:** on failure, `401 { "error": { "message": "Unauthorized" } }`.
- **Relevant schemas:** `securitySchemes.bearerAuth` (http/bearer), `ErrorResponse`.
- **Limitations:** a 401 is also returned for a company the token cannot access (e.g.
  `GET /v3/proposal-search?company_id=999999`). So a 401 does not always mean a bad token.
- **Verification status:** Verified (live). A valid token returns 200, and an invalid token returns 401 with an `ErrorResponse` body.

## Company Information

- **Endpoint:** `GET /v3/companies` (operationId `listCompanies`).
- **Request parameters:** none.
- **Response fields:** `{ data: Company[] }`. `Company`: `id` (int), `name`, `currency`
  (ISO 4217, e.g. `EUR`), `tax_mode` (`standard | simplified | tax-free | none`),
  `timezone`, `registration_number`, `website_url`, `logo_url`, `inbox_token`, `created_at`.
- **Relevant schemas:** `Company`, `TaxMode`.
- **Limitations (spec vs live):**
  - `timezone` is required (non-null string) in the spec, but **`null`** live.
  - `created_at` is an int64 in the spec with no unit; live it is **milliseconds**
    (13 digits). `ContentItem.created_at` is documented as a Unix timestamp (unit unclear).
  - `website_url` (`format: uri`) is returned as an **empty string** live.
  - Zod schemas must be lenient for these fields.
- **Verification status:** Verified (live).

## Proposal Search

- **Endpoint:** `GET /v3/proposal-search` (operationId `searchProposals`).
- **Request parameters:** `company_id`; `limit` (1–25, **default 1**); `recipient_email`
  (exact, case-insensitive); `filter[<key>]` (matches a key in the proposal `data`
  object); `exclude_revision_drafts`; `include_archived`.
- **Response fields:** `{ data: ProposalSearchResult[] }`: `uuid`, `series_uuid`,
  `company_id`, `title`, `version`, `status`, `data`, `url`, `created_at`, `updated_at`.
- **Relevant schemas:** `ProposalSearchResult`, `ProposalStatus`
  (`accepted | replaced | active | draft | expired | rejected | template | withdrawn`, nullable).
- **Limitations:**
  - At most 25 results, ordered by `updated_at` desc. **No pagination, no free-text search,
    and no status filter.**
  - Always pass `limit=25`, because the default is 1.
  - `limit=26` is accepted (200) rather than rejected. Whether the server caps it is not verified.
  - Search results do not include blocks or values, so a separate `GET /v3/proposals/{uuid}` is needed per proposal.
- **Verification status:** Verified (live) for status codes (the empty list returns 200; an inaccessible company returns 401). Result fields are Verified (spec) only, because there are no proposals yet.

## Proposal Details

- **Endpoint:** `GET /v3/proposals/{uuid}` (operationId `getProposal`).
- **Request parameters:** path `uuid`.
- **Response fields (spec):** `{ data: Proposal }`. Relevant fields: `uuid`, `series_uuid`,
  `version`, `status`, `title`, `description_md`, `language`, `currency`, `tax_options`
  (`mode`, `tax_included`), `company_tax_mode_live`, `value_with_tax`, `value_without_tax`,
  `data` (free-form metadata), `blocks`, `expires_at`. Also contains **customer PII**
  (`recipient_*`, `contact_*`, `signatures[].ip/name/user_agent`), which must not be logged or sent to the LLM.
- **Relevant schemas:** `Proposal`, `TaxOptions`, `ProposalData`.
- **Limitations:**
  - An unknown UUID **or a malformed UUID returns `500` with an empty body**, not 404 (the spec
    lists no 404 for this operation). The client must validate the UUID format first and treat 500 as "not found or unavailable".
  - Event context (dates, guest count, event type) has **no dedicated fields**. It can only come
    from the title/description text, block rows (`dateFrom`/`dateTo`, `quantity`,
    `occupancy`), or integration-defined `data` keys.
- **Verification status:** Verified (live) for the error behavior only. Response fields are Verified (spec) only.

## Proposal Blocks

- **Endpoint:** returned inside `Proposal.blocks` (no separate endpoint).
- **Response fields (spec):** `ProposalBlock`: `uuid`, `type` (`product-block | video-block`),
  `content_id` (link to the content library), `title`, `description`, `currency`,
  `quantity`, `optional`, `optional_picked`, `recurring`, prices
  `unit_value_{with|without}_discount_{with|without}_tax`, `package_split[]`
  (`accommodation | meetingRoom | food | other` with `value_with_tax`, `value_without_tax`,
  `vat`), and `multi_product_enabled` / `multi_product_data[]` (rows with `dateFrom`,
  `dateTo`, `quantity`, `occupancy`, unit values, and `subrows[]` with `content_id`,
  `quantity`, `value`, `valueWithTax`, `tax_rate`, `included`).
- **Relevant schemas:** `ProposalBlock`, `ProposalBlockInput`, `PackageSplit`,
  `MultiProductRow`, `MultiProductSubrow`.
- **Limitations:**
  - Blocks carry both tax-inclusive and tax-exclusive values, which makes it possible to stick to one VAT basis.
  - `content_id` is optional. Whether it holds the product ID or the variation ID is not documented.
  - Multi-product (package) blocks make line items nested and harder to normalize.
- **Verification status:** Verified (spec).

## Product Catalog

- **Endpoint:** `GET /v3/content` (operationId `listContent`).
- **Request parameters:** `company_id`, `product_id` / `variation_id` (comma-separated),
  `external_id`, `include_archived`, `include_sources`.
- **Response fields (spec):** `{ data: ContentItem[] }`: `product_id`, `variation_id`,
  `title` and `description` (`LocalizedText`, e.g. `{ "en": "..." }`), `created_at`,
  `deactivated_at`, `images`, `integration_id`, `integration_metadata`, `sources`.
- **Relevant schemas:** `ContentItem`, `LocalizedText`, `ContentImage`.
- **Limitations:**
  - **No price, currency, VAT, unit, category or availability fields** (see Product Pricing).
  - Products are made of variations (`product_id` and `variation_id`). The live structure has not been seen yet.
  - An inaccessible `company_id` returns `200 { data: [] }` (unlike search, which returns 401).
  - A non-numeric `product_id` returns `400 { error: { message } }`.
  - Live (two untitled items accidentally created in the UI, then archived): `product_id`
    and `variation_id` are **different IDs** (e.g. 190551 / 190478). `created_at` is in
    **milliseconds**. `title` and `description` can be **empty objects `{}`**, so the UI
    needs a fallback label. With `include_sources=true`, `sources` is `{}` and `integration_*` are `null`.
  - **Archiving:** archived items are left out by default. With `include_archived=true` they are
    returned with `is_archived: true` and `deactivated_at` set (milliseconds).
- **Verification status:** Verified (live) for status codes, archiving and the fields of untitled
  items. Images, multiple variations and localization are Verified (spec) only.

## Product Pricing

- **Endpoint:** none for the catalog.
- **Findings:** the content library has **no pricing at all**, either on read (`ContentItem`) or on
  write (`CreateContentRequest` / `UpdateContentRequest` accept only title, description and images).
  Prices exist **only on proposal blocks**, as unit values with/without discount and
  with/without tax, plus the block `currency` and the proposal `tax_options.tax_included`.
- **Limitations:**
  - Cross-sell and upgrade uplift **cannot** be priced from the catalog API.
  - Extension uplift (more units of a product already in the proposal) **can** be priced
    deterministically from that block's own unit value.
  - The smallest-currency-unit claim is not yet verified live.
- **Verification status:** Verified (spec). This is an important constraint for Steps 4–6.

## Optional Products

- **Endpoint:** fields on `ProposalBlock`: `optional` (offered as optional) and
  `optional_picked` (selected by the customer); also `quantity_editable`.
- **Limitations:** optional products only exist within a proposal. There is no "optional"
  flag in the catalog.
- **Verification status:** Verified (spec).

## Draft Updates

- **Endpoints (spec):**
  - `PATCH /v3/proposals/{uuid}` (`updateProposalDraft`): updates a **draft or template**
    in place. The body needs `company_id` plus at least one field. **`blocks` replaces the full
    ordered block list**, so the existing blocks (with their `uuid`) must be re-sent. Can return 409 (conflict).
  - `PATCH /v3/proposals/{uuid}/data`: shallow-merges keys into the proposal `data` metadata (a null value deletes a key).
  - `POST /v3/proposals`: creates a new proposal series with an editable draft.
- **Limitations:**
  - Only drafts are editable in place. Sent proposals need a new version (see Proposal Versioning).
  - A full block replacement means any mistake can drop existing items. A write must be built from a
    freshly fetched proposal and shown to the user before sending.
  - None of these endpoints sends or publishes a proposal. Sending is not part of the API.
- **Verification status:** Verified (spec). Not exercised live: writes require explicit user approval.

## Proposal Versioning

- **Endpoint:** `POST /v3/proposals/{uuid}` (`createProposalVersion`): "creates or updates
  the next draft version in the same proposal series". Repeated calls return the same draft
  until it is sent or archived. The body is the same as for create (`company_id`, `language` required).
- **Response fields:** `ProposalMutationResponse`: `{ proposal: { uuid, url } }`.
- **Limitations:** proposals are grouped by `series_uuid` and `version`. Status `replaced`
  marks superseded versions. The search parameter `exclude_revision_drafts` hides revision drafts.
- **Verification status:** Verified (spec).

## API Limitations

- **Rate limits:** no rate-limit headers were observed (`x-ratelimit-*`, `retry-after`), so the limits are unknown.
- **Pagination:** none on any list endpoint. Search is capped at 25 results.
- **Errors:** `ErrorResponse { error: { message, code?, issues? } }` for 400/401. A missing or
  malformed proposal returns **500 with an empty body**.
- **Spec drift:** the live `Company` data breaks the spec (null `timezone`, empty-string URI,
  millisecond timestamps), so response schemas should be lenient and validate only the fields we use.
- **Free-form metadata:** `ProposalData` is integration-defined (`additionalProperties: true`).
- **Verification status:** Verified (live) where stated above.

## Open Questions

Answered:
- How are proposals listed or searched, and is pagination supported? → `proposal-search`, max 25, no pagination.
- Can a proposal draft be updated safely without publishing or sending it? → Yes per spec (`PATCH` on drafts only, nothing is sent). Not live-tested.
- Does the API support "optional" products within a proposal? → Yes, via block `optional` / `optional_picked`.
- Does the API expose product availability? → No.
- Are catalog prices available? → **No**. Prices exist only on proposal blocks.

Still open:
- **Test data:** decided. Seed through the API with a repeatable script (Step 2a). The archived
  accidental items 190551/190552 are left untouched.
- **Pricing source:** decided. An app-side rate card for cross-sell and upgrade; proposal block
  prices for extensions (see `IMPLEMENTATION_PLAN.md`, Step 2 checkpoint).
- Does `block.content_id` reference `product_id` or `variation_id`?
- Are block monetary values in the smallest currency unit, as the spec says?
- Can one proposal mix currencies (`block.currency` vs `proposal.currency`)?
- How is `tax_included` reflected in block values for `standard` tax mode?
- What is the live structure of `multi_product_data` and `package_split`?
