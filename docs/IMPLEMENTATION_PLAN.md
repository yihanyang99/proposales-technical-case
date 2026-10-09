# Revenue Copilot — Implementation Plan

Incremental plan for the take-home assignment. Execute **one step at a time**, and only
when explicitly requested. After each step: review the changes, run checks, verify the
acceptance criteria, update this file, make one focused commit (with user approval), and stop.

**Status values:** `TODO` · `IN PROGRESS` · `DONE` · `BLOCKED`

| Step | Title | Status |
|------|-------|--------|
| 0 | Project Documentation | DONE |
| 1 | Next.js Initialization | TODO |
| 2 | Proposales API Investigation (architecture checkpoint) | TODO |
| 3 | Proposal Retrieval & Selection | TODO |
| 4 | Product Catalog Integration | TODO |
| 5 | AI Recommendation Engine | TODO |
| 6 | Revenue Simulation | TODO |
| 7 | Recommendation Feedback Loop | TODO |
| 8 | Dashboard UI | TODO |
| 9 | Testing & Vercel Deployment | TODO |

> **Important:** Step 2 is an architecture checkpoint. Steps 3–9 are provisional and may be
> revised once the real capabilities of the Proposales API are known. Do not assume every
> planned feature is supported.

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
- `npm run build`, `npm run lint` and `npm run typecheck` succeed.
- The dev server renders the placeholder page.
- No secrets are committed, and `.env.local` is ignored.

**Expected commit:** `chore: initialize next.js project`

**Status:** TODO

---

## Step 2 — Proposales API Investigation (Architecture Checkpoint)

**Goal:** Find out what the Proposales API actually supports and adjust the plan to match.

**Tasks:**
- Study the official OpenAPI specification: https://docs.proposales.com/openapi.json
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
- `API_FINDINGS.md` is filled in from verified behavior, and any unverified item is still
  marked "Not yet verified."
- A server-only client can authenticate and fetch at least one real resource.
- The API key is never exposed to the client bundle.
- The implementation plan is updated to reflect real API capabilities, and the changes are
  reviewed with the user.

**Expected commit:** `docs: document proposales api findings` (may also include the minimal
API client; if so, use `feat: add proposales api client and document findings`)

**Status:** TODO

---

## Step 3 — Proposal Retrieval & Selection

**Goal:** Let the user browse and select an existing proposal, then view its details.

**Tasks:**
- Add a server-side function to list or search proposals (as supported by the API).
- Add a server-side function to fetch proposal details and blocks.
- Normalize the proposal data into an internal, Zod-validated domain model (event context,
  line items, quantities, currency, VAT basis).
- Build a simple proposal list/selector and a detail view.
- Handle loading, empty and error states.
- Avoid logging customer personal data.

**Dependencies:** Step 2.

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
- Add a server-side function to fetch products (and pricing, if available).
- Normalize products into an internal model: ID, name, description, category, unit price,
  currency, VAT basis, unit, and availability (when known).
- Represent missing pricing explicitly. Never default it to 0.
- Show the catalog (or the relevant subset) alongside the proposal for verification.

**Dependencies:** Step 2. Can run in parallel with Step 3 in principle, but is executed after it.

**Acceptance criteria:**
- Real catalog products are fetched and validated.
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
- Build a prompt that gives the model only the necessary proposal context and the
  catalog, and leaves out sensitive customer data where possible.
- Validate the output: drop unknown product IDs, products already in the proposal (for
  cross-sell), and duplicates. Enforce a maximum of 3.
- Support an empty result with a clear "no suitable opportunities" message.
- Expose this through a validated server endpoint or server action.

**Dependencies:** Steps 3 and 4.

**Acceptance criteria:**
- Recommendations reference only real catalog product IDs.
- The LLM never supplies prices. Prices come only from the catalog.
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
  - Cross-sell: unit price × quantity.
  - Upgrade: (replacement price − existing price) × quantity.
  - Extension: additional units × unit price.
- Derive quantities deterministically from proposal data (guests, nights, days) where possible.
- Refuse to add amounts that use different currencies or VAT bases. Return an explicit
  "not comparable" or "price unavailable" result instead.
- Add unit tests covering normal cases, missing prices, currency mismatches and VAT mismatches.
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
- Optional, only if Step 2 confirmed safe draft updates: an "apply to draft" action
  that requires explicit confirmation and never sends or publishes.

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
