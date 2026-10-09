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
| 2a | Test Data Seeding (added at the Step 2 checkpoint) | TODO |
| 3 | Proposal Retrieval & Selection | TODO |
| 4 | Product Catalog Integration | TODO |
| 5 | AI Recommendation Engine | TODO |
| 6 | Revenue Simulation | TODO |
| 7 | Recommendation Feedback Loop | TODO |
| 8 | Dashboard UI | TODO |
| 9 | Testing & Vercel Deployment | TODO |

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
- The seed script can be re-run safely without duplicates.
- Proposals are visible through `searchProposals` and `getProposal` with priced blocks.
- `API_FINDINGS.md` open questions about blocks and pricing are answered from live data.
- No proposal is sent or published, and no customer PII beyond obviously fake test contacts is created.

**Expected commit:** `chore: add proposales test data seed script`

**Status:** TODO

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
- Real proposals are listed and can be selected.
- The selected proposal's details and line items are displayed.
- Invalid or unexpected API responses are handled gracefully.

**Expected commit:** `feat: add proposal retrieval and selection`

**Status:** TODO

---

## Step 4 — Product Catalog Integration

**Goal:** Retrieve the hotel's real product catalog for use in recommendations.

**Tasks:**
- Fetch products with `listContent`. Prices are not available from the API.
- Add the rate card `data/rate-card.json` with a Zod schema, keyed by `product_id`, giving
  unit price (minor units), currency, VAT basis and unit (per night, per person, per day...).
- Join catalog and rate card into an internal product model. Use a fallback label for
  untitled products. Products without a rate-card entry get an explicit "price unavailable".
  Never default to 0.
- Do not model availability, because the API does not expose it.
- Show the catalog (or the relevant subset) alongside the proposal for verification.

**Dependencies:** Steps 2 and 2a. Can run in parallel with Step 3 in principle, but is executed after it.

**Acceptance criteria:**
- Real catalog products are fetched and validated, and every rate-card entry refers to a real product.
- Products with missing or ambiguous pricing are flagged.
- Currency and VAT basis are captured for each priced product.

**Expected commit:** `feat: integrate proposales product catalog`

**Status:** TODO

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
- Recommendations reference only real catalog product IDs.
- The LLM never supplies prices. Prices come only from the rate card or proposal blocks.
- Malformed model output is handled without crashing.
- An empty recommendation result is handled correctly.

**Expected commit:** `feat: add ai recommendation engine`

**Status:** TODO

---

## Step 6 — Revenue Simulation

**Goal:** Deterministically calculate the potential additional revenue for each
recommendation and for the selected set.

**Tasks:**
- Implement pure functions in `lib/revenue/`:
  - Cross-sell: rate-card unit price × quantity.
  - Upgrade: (rate-card replacement price − existing block unit price) × quantity.
  - Extension: additional units × the existing block's unit price.
- Work in integer minor units (as confirmed in Step 2a), and use one VAT basis per proposal
  (block values without tax unless the proposal is tax-inclusive). Show where each price
  came from (rate card or proposal).
- Derive quantities deterministically from proposal data (guests, nights, days) where possible.
- Refuse to add amounts that use different currencies or VAT bases. Return an explicit
  "not comparable" or "price unavailable" result instead.
- Add a test runner (Vitest) and unit tests covering normal cases, missing prices, currency
  mismatches and VAT mismatches, plus Proposales client error mapping.
- Label totals in the UI as "potential additional revenue."

**Dependencies:** Steps 4 and 5.

**Acceptance criteria:**
- Calculations are pure and deterministic, and the unit tests pass.
- Currencies and VAT bases are never mixed.
- Missing pricing is surfaced, not hidden.

**Expected commit:** `feat: add deterministic revenue simulation`

**Status:** TODO

---

## Step 7 — Recommendation Feedback Loop

**Goal:** Let salespeople accept or dismiss recommendations and capture structured feedback.

**Tasks:**
- Add accept and dismiss actions per recommendation.
- Dismissal requires a reason (Already included in another package / Customer has a strict
  budget / Not relevant to this event / Product is unavailable / Other) plus an optional
  comment.
- Validate feedback with Zod on the server.
- Persist feedback using the simplest justified option. Decide between in-memory/local
  storage and PostgreSQL, and document the choice. Do not store unnecessary customer data.
- Update the revenue simulation so it reflects only accepted recommendations.
- Optional (the API supports it per Step 2): "apply to draft" via `PATCH /v3/proposals/{uuid}`.
  Only for proposals with status `draft`. Build the complete block list from a freshly fetched
  proposal (the PATCH replaces all blocks), show the change for confirmation, handle 409
  conflicts, and never send or publish. Creating a new version of a sent proposal is out of scope.

**Dependencies:** Steps 5 and 6. Step 2 findings for the optional draft write.

**Acceptance criteria:**
- Accept and dismiss work, and a dismissal cannot be submitted without a reason.
- Feedback is stored in a structured form suitable for future improvement.
- No proposal is modified without explicit approval, and none is ever sent or published.

**Expected commit:** `feat: add recommendation feedback loop`

**Status:** TODO

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

**Status:** TODO

---

## Step 9 — Testing & Vercel Deployment

**Goal:** Verify critical logic and deploy a working instance to Vercel.

**Tasks:**
- Make sure tests cover revenue calculations, product ID validation, and the feedback
  schema validation.
- Run lint, typecheck, tests and the production build.
- Configure Vercel environment variables (server-only).
- Deploy and smoke-test the end-to-end flow.
- Update `README.md` with setup instructions, architecture overview, decisions, limitations
  and the deployed URL.

**Dependencies:** Steps 1–8.

**Acceptance criteria:**
- All checks pass.
- The deployed app works end to end, with no secrets in the client bundle or the repository.
- The README accurately describes what works and what does not.

**Expected commit:** `test: add critical logic tests and deployment docs` (split into
`test:` and `docs:` only if the changes are clearly separate)

**Status:** TODO

---

## Change Log

- Step 0: Initial plan created.
- Step 0 (addendum): Added a local snapshot of the Proposales OpenAPI spec as reference material.
- Step 1: Next.js project initialized (see Step 1 notes).
- Step 2: Checkpoint. Added Step 2a (test data seeding). Steps 3–7 revised: rate card for
  pricing, client-side search filtering, stricter draft-update safeguards, Vitest moved to Step 6.
