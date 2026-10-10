# Revenue Copilot — Implementation Plan

Incremental plan for the take-home assignment. Execute **one step at a time**, and only
when explicitly requested. After each step: review the changes, run checks, verify the
acceptance criteria, update this file, make one focused commit (with user approval), and stop.

**Status values:** `TODO` · `IN PROGRESS` · `DONE` · `BLOCKED`

| Step | Title | Status |
|------|-------|--------|
| 0 | Project Documentation | DONE |
| 1 | Next.js Initialization | DONE |
| 2 | Proposales API Investigation (architecture checkpoint) | DONE |
| 2a | Test Data Seeding (added at the Step 2 checkpoint) | DONE |
| 3 | Proposal Retrieval & Selection | DONE |
| 4 | Product Catalog Integration | DONE |
| 5 | AI Recommendation Engine | DONE |
| 6 | Revenue Simulation | DONE |
| 7 | Recommendation Feedback Loop | DONE |
| 8 | Dashboard UI | DONE |
| 9 | Testing & Vercel Deployment | IN REVIEW |

> **Important:** Step 2 was the architecture checkpoint. Steps 2a–9 below have been revised
> to match the real API (see "Checkpoint outcome" under Step 2 and `docs/API_FINDINGS.md`).

---

## Step 0 — Project Documentation

**Goal:** Set up the project documentation, engineering guidelines and incremental plan
before writing any code.

**Tasks:**
- Create `CLAUDE.md` with architecture, security, AI, revenue, feedback, workflow, Git,
  quality and scope guidelines.
- Create `docs/PRODUCT.md` (product requirements).
- Create `docs/IMPLEMENTATION_PLAN.md` (this file).
- Create `docs/API_FINDINGS.md` (an investigation template with no findings).
- Create `README.md` (initial project overview).

**Dependencies:** None.

**Acceptance criteria:**
- [x] All five documentation files exist.
- [x] No application code, no `package.json`, no dependencies installed.
- [x] No secrets in any file.
- [x] `API_FINDINGS.md` contains no fabricated API findings; everything is "Not yet verified."
- [x] README states that implementation has not started.
- [x] Documents are consistent with each other.

**Expected commit:** `docs: establish revenue copilot project guidelines`

**Status:** DONE

---

## Step 1 — Next.js Initialization

**Goal:** Create a minimal, strictly typed Next.js App Router project ready for development.

**Tasks:**
- Initialize Next.js (App Router, TypeScript, Tailwind CSS, ESLint).
- Enable TypeScript `strict` mode.
- Add `zod`. (The Vercel AI SDK and LLM provider are added in Step 5, when needed.)
- Add `.env.example` with `PROPOSALES_API_KEY=` and placeholders for the LLM provider key.
- Make sure `.gitignore` excludes `.env*` (except `.env.example`), `node_modules` and `.next`.
- Set up a basic folder layout: `app/`, `components/`, `lib/`.
- Replace the boilerplate home page with a minimal placeholder.
- Add npm scripts for `dev`, `build`, `lint` and `typecheck`.

**Dependencies:** Step 0.

**Acceptance criteria:**
- [x] `npm run build`, `npm run lint` and `npm run typecheck` succeed.
- [x] The dev server renders the placeholder page.
- [x] No secrets are committed, and `.env.local` is ignored.

**Expected commit:** `chore: initialize next.js project`

**Notes:**
- Scaffolded with `create-next-app@16.4.0` (Next.js 16.4, React 19.3, Tailwind CSS v4,
  ESLint 9) and kept the template defaults (`cacheComponents`, `partialPrefetching`).
- Set `agentRules: false` so `next dev` does not generate `AGENTS.md`. `CLAUDE.md` is the
  single source of agent instructions.
- Added `lib/env.ts`: lazy, Zod-validated, `server-only` access to `PROPOSALES_API_KEY`.
  This uses `zod` and adds the `server-only` package.
- `typecheck` runs `next typegen` first, so route type helpers (`LayoutProps`) exist.
- `components/` will be created with the first shared component; Git does not track empty folders.

**Status:** DONE

---

## Step 2 — Proposales API Investigation (Architecture Checkpoint)

**Goal:** Find out what the Proposales API actually supports and adjust the plan to match.

**Tasks:**
- Study the official OpenAPI 3.0 specification: https://docs.proposales.com/openapi.json
  (local snapshot: `docs/proposales-openapi.json`; check it against upstream first).
- Verify authentication (Bearer token, `PROPOSALES_API_KEY`) with read-only requests.
- Investigate company info, proposal search/listing, proposal details, proposal blocks,
  product catalog, product pricing (currency, VAT), optional products, draft updates and
  versioning.
- Document the verified findings in `docs/API_FINDINGS.md`, with a verification status
  for each section.
- Make no write calls against real data without explicit user approval.
- Add a typed, server-only Proposales client (`lib/proposales/`) with Zod schemas for the
  responses that were verified.
- **Checkpoint:** Review Steps 3–9 against the findings. Update tasks or scope where the API
  differs from expectations (e.g. drop or replace "apply to draft" if writes are not safe).
  Present the proposed plan changes to the user before continuing.

**Dependencies:** Step 1. A valid `PROPOSALES_API_KEY` must be available locally.

**Acceptance criteria:**
- [x] `API_FINDINGS.md` is filled in from verified behavior, and each item states whether it is
  verified live, from the spec only, or not yet verified.
- [x] A server-only client can authenticate and fetch at least one real resource (companies,
  content and proposal search verified live through a temporary route handler, since removed).
- [x] The API key is never exposed to the client bundle (`server-only` + `getServerEnv()`).
- [x] The implementation plan is updated to reflect real API capabilities, and the changes are
  reviewed with the user (test data and pricing decisions made 2026-10-09).

**Expected commit:** `feat: add proposales api client and document findings`

**Checkpoint outcome:**
- **The catalog has no prices.** `GET /v3/content` returns titles and descriptions only, and
  products cannot be created with a price. Prices exist only on proposal blocks.
  → **Decision:** an app-side **rate card** (`data/rate-card.json`, Zod-validated, keyed by
  Proposales `product_id`) prices cross-sells and upgrades. Extensions use the proposal
  block's own unit price. Products missing from the rate card show "price unavailable".
- **The account is empty** (no proposals or active products).
  → **Decision:** add **Step 2a** to seed realistic data through the API with a repeatable
  script. The writes need explicit approval.
- **Search** returns at most 25 proposals with no pagination or text search, so Step 3 filters client-side.
- **Event context** has no dedicated fields. It comes from the title/description, block rows
  (dates, quantity, occupancy) and `data` metadata.
- **Draft updates exist** (`PATCH /v3/proposals/{uuid}`, drafts only, full block-list replacement).
  So "apply to draft" stays optional in Step 7, with stricter safeguards.
- **Availability** is not exposed, so "Product is unavailable" remains a salesperson-supplied
  dismissal reason, and the app never claims availability.
- **Errors:** an unknown proposal returns 500 with an empty body, which the client maps to "not found".

**Notes:**
- `lib/proposales/client.ts`: read-only functions `listCompanies`, `searchProposals`
  (always `limit=25`), `getProposal` (validates the UUID, maps 500 to `not_found`) and `listContent`, with
  typed `ProposalesApiError` kinds. No write functions yet.
- `lib/proposales/schemas.ts`: lenient Zod schemas for the fields we use. The proposal schema
  leaves out recipient/contact/signature PII, so it is stripped at the boundary.
- No test runner yet. Client unit tests are added together with the revenue tests (Step 6).

**Status:** DONE

---

## Step 2a — Test Data Seeding

**Goal:** Create realistic, reproducible hotel test data in the Proposales test account, so
every later step runs on real API data.

**Tasks:**
- Add `scripts/seed.ts` (run with `npm run seed`). It uses `POST /v3/content` and `POST /v3/proposals`:
  - About 10 hotel products for an EUR hotel with standard tax: e.g. standard and superior rooms,
    half-day and full-day meeting room, AV package, coffee break, lunch, three-course dinner,
    airport transfer, spa access.
  - 3–4 **draft** event proposals with priced product blocks linked by `content_id`
    (e.g. a 2-day conference, a board meeting, a wedding, a team offsite), each leaving
    clear room for relevant cross-sells, upgrades or extensions.
  - Idempotent: skip products and proposals that already exist (matched by title). Never touch
    content the script did not create (e.g. archived items 190551/190552). Never send or publish.
- Print the exact payloads (dry run) and ask for explicit approval before the first real run.
- Generate or update `data/rate-card.json` from the created product IDs (price in minor units,
  currency, VAT basis, unit). Document how reviewers re-seed their own account.
- Live-verify the open questions in `API_FINDINGS.md`: what `content_id` references, minor
  units, the `tax_included` effect on block values, and the block, package and multi-product shapes.
  Then tighten the Zod schemas if needed.

**Dependencies:** Step 2. Explicit approval for every write run.

**Acceptance criteria:**
- [x] The seed script can be re-run safely without duplicates (a dry run after seeding plans 0 creates).
- [x] Proposals are visible through `searchProposals` and `getProposal` with priced blocks.
- [x] `API_FINDINGS.md` open questions about blocks and pricing are answered from live data.
- [x] No proposal is sent or published. Proposals have no recipients, so no customer PII was created.

**Expected commit:** `chore: add proposales test data seed script`

**Notes:**
- `scripts/seed.ts` (dry run by default, `--apply` to write, `--only=<seed_key>`) and
  `scripts/seed-data.ts`. Run with `tsx` and the `react-server` condition, so it reuses
  `lib/env.ts` and the read-only client for lookups. Writes stay in the script, not in `lib/`.
- Ran in two approved phases. Phase 1 (board meeting: 2 products, 1 proposal) verified that
  `content_id` is the `variation_id` and that prices are in cents (€558.00 confirmed in the UI).
  Phase 2 created 10 products and 3 proposals. That makes 16 writes in total.
- `data/rate-card.json` is generated by the seed script: 12 products, EUR, prices excluding VAT, in cents,
  with `category` and `unit` in the Proposales UI vocabulary (the API exposes neither).
  `npm run seed -- --rate-card` regenerates it read-only.
  It contains IDs specific to this account. Reviewers using another account re-run `npm run seed -- --apply`.
- `searchProposals` gained an optional `dataFilters` parameter (`filter[key]=value`).

**Status:** DONE

---

## Step 3 — Proposal Retrieval & Selection

**Goal:** Let the user browse and select an existing proposal, then view its details.

**Tasks:**
- List proposals with `searchProposals` (max 25, newest first, no pagination); filter by
  title and status client-side. Fetch details and blocks with `getProposal`.
- Normalize the proposal data into an internal, Zod-validated domain model (event context,
  line items, quantities, currency, VAT basis).
- Build a simple proposal list/selector and a detail view.
- Handle loading, empty and error states.
- Avoid logging customer personal data.

**Dependencies:** Steps 2 and 2a.

**Acceptance criteria:**
- [x] Real proposals are listed and can be selected (4 seeded proposals; title search and status filter).
- [x] The selected proposal's details and line items are displayed (event context, line items, totals that match the API).
- [x] Invalid or unexpected API responses are handled gracefully (unknown or malformed ID shows
  "Proposal not found"; an invalid key shows an authorization message; unexpected errors fall back to `app/error.tsx`).

**Expected commit:** `feat: add proposal retrieval and selection`

**Notes:**
- `lib/proposals/model.ts`: pure normalization (`toProposalSummary`, `toProposalDetail`,
  `toLineItem`, `toEventContext`) and client-side filtering. Event context is parsed from
  `data` metadata with per-field Zod fallbacks, so a bad field never hides the others.
  Video blocks are skipped, and multi-product blocks are flagged as packages.
- `lib/proposals/service.ts`: server-only fetch and normalize. `searchProposals` no longer
  needs `company_id` (verified live: without it, the API searches every accessible company).
- Routes: `/` (list) and `/proposals/[uuid]` (detail). Each reads `searchParams`/`params` inside
  `<Suspense>`, as Cache Components requires (partial prerender: static shell plus streamed data).
- Not-found is rendered inline, because a streamed response cannot change its HTTP status to 404.
- Search is a title-only, case-insensitive match over the loaded proposals (the API has no text
  search). Status uses **filter chips** (pill links with counts, only statuses present) instead of a
  `<select>`, whose open menu cannot be styled. Both are URL-based: no client JavaScript, and unknown
  `status` values are ignored.
- The list shows "N proposals". The API-limit note appears only when the search returns its maximum (25).
- Money is shown from minor units with `Intl.NumberFormat`. A missing price shows "Price unavailable".
- **Branding:** matches the Proposales visual language without copying their brand assets:
  - Switzer font (Fontshare, ITF Free Font License, self-hosted in `app/fonts/`).
  - Monochrome design tokens in `app/globals.css`: grey page, white rounded surfaces, no borders,
    pill controls, colour only for success and failure.
  - Our own favicon and mark (`app/icon.svg`, `BrandMark`), with "Revenue Copilot · for Proposales"
    in the header. The Proposales logo is deliberately not used.
- **UI library:** `components/ui/` holds Button, Input, FieldLabel, Card, Chip/ChipGroup, Badge,
  Dot, Alert, EmptyState, Skeleton, Page/PageHeader/SectionTitle and Table primitives. Pages
  compose these, and the rules are in `CLAUDE.md` ("UI Library").

**Status:** DONE

---

## Step 4 — Product Catalog Integration

**Goal:** Retrieve the hotel's real product catalog for use in recommendations.

**Tasks:**
- Fetch products with `listContent`. Prices are not available from the API.
- Add a Zod schema for the rate card `data/rate-card.json` (generated in Step 2a). It is keyed by
  `product_id`/`variation_id` and gives unit price (minor units), currency, VAT basis, `category`
  and `unit` (`night | day | person | unit`, plus an optional `unitLabel`).
- Join catalog and rate card into an internal product model. Use a fallback label for
  untitled products. Products without a rate-card entry get an explicit "price unavailable".
  Never default to 0.
- Do not model availability, because the API does not expose it.
- Show the catalog (or the relevant subset) alongside the proposal for verification.

**Dependencies:** Steps 2 and 2a. Can run in parallel with Step 3 in principle, but is executed after it.

**Acceptance criteria:**
- [x] Real catalog products are fetched and validated, and every rate-card entry refers to a real
  product (12 live products, 12 priced, 0 orphaned entries; orphans are flagged in the UI).
- [x] Products with missing or ambiguous pricing are flagged ("Price unavailable", grouped under
  "Not in rate card", with a notice above the catalog).
- [x] Currency and VAT basis are captured for each priced product (the rate card schema requires
  `currency`, `vatBasis: "excluded"`, minor units, and a VAT rate per product).

**Expected commit:** `feat: integrate proposales product catalog`

**Notes:**
- `lib/catalog/rate-card.ts`: Zod schema, parsed once at module load (an invalid rate card fails
  fast). It rejects duplicate `variation_id`s.
- `lib/catalog/model.ts`: pure `joinCatalog` (matched on `variation_id`, which proposal blocks
  reference as `content_id`), `pickLocalized`, and `groupByCategory`.
  `lib/catalog/service.ts`: server-only `getCatalog`.
- The catalog is scoped to the **proposal's own company** (`company_id`), so a token with access
  to several hotels never mixes catalogs. Archived products are excluded by the API by default.
- The proposal detail page shows a "Hotel catalog" section in its own `<Suspense>` boundary:
  one card per category (with a Proposales-style line icon), list price per Proposales unit,
  VAT rate, and an "In proposal" pill. `unitLabel` is not displayed; it is kept as AI context
  for Step 5.
- UI updates in this step: a glass header (`surface-glass` token plus backdrop blur), and
  `TableHeaderCell` is now left-aligned by default.
- Availability is not modelled, because the API does not expose it.
- Verified with a read-only script against live data. Unit tests for the join come with Vitest in Step 6.

**Status:** DONE

---

## Step 5 — AI Recommendation Engine

**Goal:** Generate 0–3 relevant, explained revenue opportunities from the proposal and catalog.

**Tasks:**
- Add the Vercel AI SDK and the chosen LLM provider (server-side only).
- Define the Zod recommendation schema: `type` (cross-sell / upgrade / extension),
  `productId`, optional `replacesProductId` / existing line reference, `suggestedQuantity`
  rationale, `explanation`, and qualitative `confidence`.
- Build a prompt that gives the model only the necessary proposal context (title,
  description, blocks with dates/quantities, relevant `data` metadata) and the catalog. Customer
  PII is already stripped by the proposal schema and is never sent to the model.
- Validate the output: drop unknown product IDs, products already in the proposal (for
  cross-sell), and duplicates. Enforce a maximum of 3.
- Support an empty result with a clear "no suitable opportunities" message.
- Expose this through a validated server endpoint or server action.

**Dependencies:** Steps 3 and 4.

**Acceptance criteria:**
- [x] Recommendations reference only real catalog product IDs (validation drops unknown
  products and line items; verified with crafted output on live data).
- [x] The LLM never supplies prices. The output schema has no price fields; prices come only
  from the rate card or proposal blocks.
- [x] Malformed model output is handled without crashing (`NoObjectGeneratedError` /
  `NoOutputGeneratedError` map to an inline message; bad individual suggestions are dropped).
- [x] An empty recommendation result is handled correctly ("No suitable opportunities found").

**Expected commit:** `feat: add ai recommendation engine`

**Notes:**
- Provider: **OpenAI through the Vercel AI SDK** (`@ai-sdk/openai`), model `gpt-5-mini` by
  default (`OPENAI_MODEL`), reasoning effort `low`, and strict structured output via
  `generateText` + `Output.object`. Chosen over the Vercel AI Gateway and Anthropic for cost and
  simplicity; the AI SDK keeps the provider swappable.
- `lib/recommendations/`: the lenient model output schema; pure `validateRecommendations`, which
  drops unknown product, unknown line item, already in proposal, line item mismatch, category
  mismatch, not an upgrade, invalid quantity, duplicate and over the limit of three (an upgrade's
  quantity is forced to the line item's); a prompt containing event facts, line items and catalog
  but no PII; the server-only engine; and a deterministic **mock mode** (`RECOMMENDATIONS_MODE=mock`)
  for UI work without API calls.
- `quantityLabel`: the model writes the quantity as a compact multiplication ("80 guests × 2 days").
  It is shown only if its numbers multiply to exactly the quantity.
- Server action `findOpportunities` (`app/proposals/[uuid]/actions.ts`) validates the UUID,
  re-fetches proposal and catalog server-side, and returns plain view data.
- UI: "Revenue opportunities" panel with verb titles (Add / Upgrade / Extend), a type pill,
  confidence as `LevelBars` plus a word, the calculation line, and the value on the proposal's VAT
  basis with its VAT rate. New UI components: `Spinner` and `LevelBars`.
- **Pulled forward from Step 6:** `lib/revenue/uplift.ts` (deterministic value per opportunity
  in integer cents, both VAT bases, currency check), because the cards show values.
- Live check: one `gpt-5-mini` call on the Tech Summit took 8.8 s and returned 3 suggestions,
  3 kept and 0 dropped.
- Code review: one issue (the public, unthrottled AI endpoint enables cost abuse), deferred to Step 9.

**Status:** DONE

---

## Step 6 — Revenue Simulation

**Goal:** Let the salesperson select opportunities and adjust their quantities, and
deterministically calculate the potential additional revenue for each one and for the selected set.

**Tasks:**
- Per-opportunity values in `lib/revenue/uplift.ts` exist already (pulled forward in Step 5):
  - Cross-sell: rate-card unit price × quantity.
  - Upgrade: (rate-card replacement price − existing block unit price) × quantity.
  - Extension: additional units × the existing block's unit price.
- **Select opportunities** to include in the simulation, and **edit the quantity** per
  opportunity (an integer from 1 to 10,000). The amount always stays list price × quantity, so it is
  never typed in directly; the calculation line and value update immediately.
- Show a running total of the selected opportunities, on the proposal's VAT basis. *(Revised: the
  current proposal total is no longer repeated; it is already in the line items above. The
  summary shows the selected opportunities with subtotal, VAT and potential revenue incl. VAT.)*
- Work in integer minor units (as confirmed in Step 2a), and use one VAT basis per proposal
  (block values without tax unless the proposal is tax-inclusive).
- Refuse to add amounts that use different currencies or VAT bases. Return an explicit
  "not comparable" or "price unavailable" result instead.
- Add a test runner (Vitest) and unit tests covering normal cases, missing prices, currency
  mismatches and VAT mismatches, plus Proposales client error mapping.
- Label totals in the UI as potential revenue.

**Dependencies:** Steps 4 and 5.

**Acceptance criteria:**
- [x] Calculations are pure and deterministic, and the unit tests pass (Vitest: 67 tests
  in 6 files; a deliberate bug in the total makes them fail).
- [x] Currencies and VAT bases are never mixed (`calculateUplift` returns null on a currency
  mismatch; values and totals use the proposal's VAT basis).
- [x] Missing pricing is surfaced, not hidden ("Value unavailable", which can't be included and
  is never counted).

**Expected commit:** `feat: add deterministic revenue simulation`

**Notes:**
- `lib/revenue/simulation.ts` (pure, used in the browser): `opportunityAmount` (unit price minus
  the replaced unit price, × quantity) and `simulateTotals` (current + selected = potential;
  opportunities without a value are never counted).
- Each card has an **Include** toggle and a **quantity stepper** (`QuantityInput`, a new UI
  component). The calculation line, value and running total update live. Quantity limits:
  1–10,000, and an upgrade can't exceed the booked units. Nothing is selected by default.
- Each fact appears once. Titles say what (Add / Upgrade … to … / Extend + item). The calculation
  line shows the AI's verified breakdown ("20 rooms × 1 night × €145.00"; the prompt asks for
  "N rooms × M nights" breakdowns) and falls back to plain units after an edit
  ("21 × €145.00 / night"). Only after an edit, "Suggested: 20 rooms × 1 night" appears under the
  stepper and resets the quantity when clicked. The prompt asks explanations to say why it fits
  without repeating the product or quantity. The card shows "excl. VAT"; the rate is listed per
  opportunity in the Potential revenue card.
- A **Potential revenue** card (beside the opportunities and sticky on large screens, below them on
  smaller ones) lists only the included opportunities, by name with their VAT rate, on the
  proposal's VAT basis, then their subtotal excl. VAT, VAT and total incl. VAT
  (`simulateTotals`, from the server's prices on both bases, so rounding matches the cards).
  Each new "Find again" run resets the selection.
- Vitest covers the revenue math, the simulation, the recommendation validation and quantity
  labels, the catalog join, the proposal model, and the Proposales client's error mapping
  (with a fake `fetch`). `server-only` is aliased to an empty module in `vitest.config.mts`.
- **Conflicting opportunities.** The model marks alternatives (`conflictsWith`, e.g. two catering
  options for the same slot). Validation adds the structural ones it can't miss (two upgrades of
  the same line item, an upgrade and a cross-sell of the same product), ignores references to
  dropped or unknown suggestions and makes the links symmetric. Including one alternative removes
  the other (`toggleSelection`). An upgrade and an extension of the same line stay combinable;
  when both are included, the extension is priced at the original rate, not the upgrade. Both
  cases are explained in a notice above the Potential revenue card.
- The confidence level is shown as fit ("Strong fit", "Good fit", "Possible fit"), matching what
  the prompt asks for; the field keeps the name `confidence`.
- Also on this branch: `refactor: move vat column next to item in line items`.

**Status:** DONE

---

## Step 7 — Recommendation Feedback Loop

**Goal:** Let salespeople add opportunities to the proposal or mark them as not a fit, capture
structured feedback, and update the draft in Proposales.

**Tasks:**
- Per opportunity: **Add to proposal** (keeps the chosen quantity, including manual changes,
  which is a useful feedback signal) or **Not a fit**, with a required reason (Already included
  in another package / Customer has a strict budget / Not relevant to this event / Product is
  unavailable / Other) and an optional comment.
- Validate feedback with Zod on the server and persist it with the simplest justified option.
  Do not store unnecessary customer data.
- **Update the draft in Proposales** (`PATCH /v3/proposals/{uuid}`) after an explicit
  confirmation: every opportunity becomes an optional extra the customer can pick, existing
  items never change, only drafts, never send or publish. Build the full block list from a
  freshly fetched proposal (the PATCH replaces all blocks) and handle 409 conflicts.

**Dependencies:** Steps 5 and 6; Step 2 findings for the draft write.

**Acceptance criteria:**
- Adding and "not a fit" work, and "not a fit" cannot be saved without a reason.
- Feedback is stored in a structured form suitable for future improvement.
- No proposal is modified without explicit confirmation, existing items are never changed, and
  nothing is ever sent or published.

**Expected commits:** `feat: add recommendation feedback loop` and
`feat: add opportunities to the draft in proposales`

**Decisions:**
- **Storage: Postgres on Neon** (Vercel Marketplace, Frankfurt), one `recommendation_feedback`
  table via `@neondatabase/serverless` and parameterised SQL, no ORM. Feedback must survive
  deploys, be shared by all salespeople and be queryable. In-memory or a file is lost on Vercel,
  browser storage stays on one device, and the proposal `data` would turn every click into a
  write to the customer's data. Without `DATABASE_URL`, development uses an in-memory store and
  production refuses to run.
- **Opportunities go in as optional extras**, so the customer decides and the original plan is
  untouched. Unpicked optional blocks don't count in the proposal total (verified live).
- **Upgrades are an upgrade supplement product** ("Upgrade: Standard Double Room → Superior
  Double Room"), optional, priced at the difference for every booked unit. Proposales takes
  block titles from the content library and has no either/or between blocks, so a room at the
  difference would look like a cheap room and a room at full price would be paid twice. The
  supplement is found by title or created (`POST /v3/content`) on first use, after confirmation,
  and is hidden from the catalog and the AI.

**Notes:**
- Cards: **Add to proposal** / **Added** (click to remove) and **Not a fit**, which opens the
  reason chips (`ChoiceChip`, native radios) and a comment field. Typing a comment without a
  chip selects **Other** (the text is the reason). A card marked not a fit collapses to its
  title and reason with **Undo**. Adding an alternative removes the added alternative.
- Each choice is saved at once (`saveFeedback` / `clearFeedback`; Zod-validated), one row per
  proposal and suggestion (`type:productId:lineItemId`, stable across runs), saved in order so
  the last click wins; a failed save shows Retry. Stored: ids, type, suggested and chosen
  quantity, fit level, decision, reason, comment, timestamp. No proposal or customer data.
- **Used for improvement:** "Find again" restores earlier choices, and the prompt gets this
  proposal's dismissals with their reason (`previouslyDismissed`). Comments may name the
  customer, so they are never sent to the model. An upgrade already offered as a supplement is
  not suggested again.
- The **Potential revenue** card lists the added opportunities ("Optional for the customer")
  with Subtotal / VAT / Total. **Update draft in Proposales** asks "Add 2 optional extras to the
  draft? Nothing is sent to the customer."; **Confirm** calls `applyProposalUpdate`, which
  re-fetches the proposal, re-derives every price from the rate card and the proposal, re-sends
  every existing block with all its input fields (a loose write-path schema keeps fields like
  `package_split`), appends one optional block per opportunity with `quantity_editable: true`
  (the customer can change the amount), and maps errors (not a draft, 409) to clear messages.
  Afterwards the cards show "In proposal", the line items reload, and **Open proposal** links
  to the Proposales editor (`lib/proposales/links.ts`).
- The hotel catalog shows each product's status in the proposal: **In proposal** (included),
  **In proposal · extension offered**, **Optional extra**, or **Optional upgrade** (offered
  through its supplement).
- The only Proposales writes live in `lib/proposals/draft-service.ts`.
- Tests: feedback schema and decisions, prompt context without comments, in-memory store, draft
  planner (pricing, supplements, refusals, block list), supplement filter, catalog status,
  editor link — 104 tests in 10 files.

**Status:** DONE (verified live: feedback in Neon, and draft updates with optional extras, an
upgrade supplement and flexible quantities)

---

## Step 8 — Dashboard UI

**Goal:** Tie the workflow together into a clear, usable single-page experience.

**Tasks:**
- Lay out the flow: proposal selection → proposal summary → recommendations
  (type, product, explanation, confidence, potential uplift) → accept/dismiss → revenue summary.
- Handle loading, empty and error states throughout.
- Make the "potential, not guaranteed" labeling and the qualitative meaning of confidence clear.
- Keep components focused, with business logic kept in `lib/`.
- Apply basic responsive styling with Tailwind. No unnecessary polish.

**Dependencies:** Steps 3–7.

**Acceptance criteria:**
- The full journey works end to end in the browser with real data.
- All states (loading, empty, error, no recommendations) are handled.

**Expected commit:** `feat: build revenue copilot dashboard`

**Notes:**
- Most of the journey was built in Steps 3–7; this step reviewed it end to end and closed the
  gaps: the line items show only what is included, so their total matches Proposales' own total
  (which excludes unpicked extras), and an **Optional extras** table of the same width and
  style beside them lists what the customer can pick, with its own Subtotal / VAT / Total
  (`sumLineItems`). The VAT rate is a small line under each item name instead of a column, as in
  the catalog and the side cards. Also: an
  **Open in Proposales** link to the editor in the proposal header; a notice up front when a
  proposal isn't a draft (suggestions stay available as advice); a styled `not-found.tsx`; and a
  one-line intro on the proposal list. The hotel catalog is collapsed by default (native
  `<details>`, "12 products · what the AI chooses from"), since it is mostly the AI's input and
  long for a real hotel; opened, it has a search field and category chips (several can be
  selected; none means all) that filter in the browser (`CatalogBrowser`). It is one card: the categories are stacked sub-sections inside
  it, so an uneven category never leaves gaps.
  Both tables use a fixed layout with the same column widths
  and top-aligned rows; the totals block sizes to its content.

**Status:** DONE

---

## Step 9 — Testing & Vercel Deployment

**Goal:** Verify critical logic and deploy a working instance to Vercel.

**Tasks:**
- Extend the tests (Vitest, set up in Step 6) to the feedback schema validation from Step 7.
- Run lint, typecheck, tests and the production build.
- Configure Vercel environment variables (server-only), including `OPENAI_API_KEY`, and make
  sure `RECOMMENDATIONS_MODE` is unset or `live` in production.
- **Protect the deployment against cost abuse** (code review, Step 5): the "Find opportunities"
  server action is a public endpoint that triggers a paid OpenAI call on every request, with no
  authentication or rate limit. Turn on Vercel Deployment Protection (password or Vercel login)
  for the deployment, and set a monthly spending limit on the OpenAI project.
- Keep test feedback out of production: point local development at a Neon `dev` branch and the
  Vercel deployment at `main` (or clear `recommendation_feedback` once before going live). Set
  the Vercel function region to Frankfurt (`fra1`), next to the database.
- Deploy and smoke-test the end-to-end flow.
- Update `README.md` with setup instructions, architecture overview, decisions, limitations
  (e.g. list prices come from the app rate card because the catalog API has no prices) and the
  deployed URL.

**Dependencies:** Steps 1–8.

**Acceptance criteria:**
- All checks pass.
- The deployed app works end to end, with no secrets in the client bundle or the repository.
- The deployment is not publicly usable without protection, and OpenAI spend is capped.
- The README accurately describes what works and what does not.

**Expected commit:** `test: add critical logic tests and deployment docs` (split into
`test:` and `docs:` only if the changes are clearly separate)

**Notes:**
- Tests: 106 in 10 files; the feedback schema and decisions were covered in Step 7.
- `vercel.json` pins functions to `fra1`, next to the Neon database.
- Vercel: the app keys are Production secrets; `DATABASE_URL` comes from the Neon integration.
  Every deployment URL keeps serving its own build; the production domain
  (https://proposales-technical-case.vercel.app) always points to the latest.
- **Access:** Vercel Deployment Protection covers only the deployment URLs, not the production
  domain (found in the final check: the domain was public). So the whole app is behind a
  shared-password **login page** (`/login`): the password (`APP_PASSWORD`) is compared in
  constant time with a short pause on a mistake; success sets a signed, `httpOnly` session
  cookie (HMAC derived from the password, 7 days), and `proxy.ts` checks it on every request
  (pages redirect to the login and back; server actions get 401). The return path only allows
  paths inside the app. Without `APP_PASSWORD`, production refuses every request (503) instead
  of being open; locally the login is skipped. Tested in `lib/auth/session.test.ts`. The login
  page hides the header with one CSS rule (`body:has([data-hide-header])`).
- Neon: local development uses a `dev` branch (separate endpoint, verified); production's
  `main` table was cleared once, and the seeded drafts were reset to seed status.
- Secret scan of the full Git history: no keys or connection strings; only `.env.example` is
  tracked.
- README rewritten: journey, architecture, decisions, limitations (rate card), local setup,
  environment variables, deployment and future improvements.

**Status:** IN REVIEW

---

## Change Log

- Step 0: Initial plan created.
- Step 0 (addendum): Added a local snapshot of the Proposales OpenAPI spec as reference material.
- Step 1: Next.js project initialized (see Step 1 notes).
- Step 2: Checkpoint. Added Step 2a (test data seeding). Steps 3–7 revised: rate card for
  pricing, client-side search filtering, stricter draft-update safeguards, Vitest moved to Step 6.
- Step 2a: Seeded 12 products and 4 draft proposals; open API questions answered live.
- Step 3: Proposal list and detail pages on live data.
  Committed as three commits (brand styling, UI library, feature) instead of one, at the
  user's request, to keep the review manageable. Each commit builds on its own.
- Step 4: Catalog joined with the rate card, shown on the proposal page.
- Step 5: AI recommendations via OpenAI (`gpt-5-mini`, Vercel AI SDK) with deterministic
  validation, a mock mode, and value cards; per-opportunity revenue was pulled forward from Step 6.
  Steps 6–7 revised: Step 6 adds selecting opportunities and editing quantities, with a running
  total; Step 7 stores accepted quantities as feedback. Step 9 adds deployment protection and an
  OpenAI spending limit (code review).
- Step 6: Opportunity selection, quantity editing and a running potential total; Vitest set up
  with 65 tests covering revenue, validation, catalog, proposal model and client error mapping.
- Step 6: Conflicting opportunities: the model's judgement plus structural rules; alternatives
  can't be included together, and an extension notes when it is priced below an included upgrade.
- Step 6: The Potential revenue card sits beside the opportunities and lists only the selected
  ones, with subtotal, VAT and total incl. VAT.
- Step 6: Opportunity cards show each fact once; the page is wider to fit the side column.
- Step 7: "Apply to draft" moved from optional to core: opportunities are added to the draft in
  Proposales as optional extras (upgrades as a supplement at the difference), existing items
  never change. Feedback (added / not a fit with a reason) is stored in Postgres on Neon and
  feeds the next prompt.
- Step 8: Reviewed the full journey and closed the gaps (included items and optional extras
  side by side with their own totals, VAT under item names, editor link, non-draft notice, 404
  page, list intro).
- Step 8: The hotel catalog is collapsed by default, with search and multi-select category
  filters, since it is mostly the AI's input.
