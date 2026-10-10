# Revenue Copilot

An AI revenue assistant for hotel sales teams using [Proposales](https://proposales.com). It
reviews a proposal against the hotel's real product catalog, suggests up to three revenue
opportunities with a deterministic value, and adds the ones the salesperson picks to the
**draft in Proposales as optional extras** the customer can choose.

**Live:** https://proposales-technical-case.vercel.app (password-protected; credentials are shared
separately)

## How it works

1. **Pick a proposal** from your Proposales account (search and status filters).
2. **Find opportunities.** The AI reads the event facts (type, guests, dates), the line items
   and the hotel catalog, and suggests up to three **cross-sells**, **upgrades** or
   **extensions**, each with a short reason and a qualitative fit (strong / good / possible).
3. **Review the value.** Code, not the AI, calculates each value from list prices, e.g.
   `20 rooms × 1 night × €145.00`. Quantities can be adjusted.
4. **Add to proposal, or mark as not a fit** with a reason (budget, not relevant, unavailable,
   already in a package, or your own words). Choices are saved and inform the next suggestions.
5. **Update the draft in Proposales.** After a confirmation, every added opportunity becomes an
   **optional block** with a flexible quantity. What the customer already has never changes,
   and nothing is sent or published. An upgrade is added as a supplement priced at the
   difference ("Upgrade: Standard Double Room → Superior Double Room", 40 × €40.00).
6. **Finish in Proposales** via *Open in Proposales*, as usual.

## Architecture

```
Browser (React, client components)
  │  server actions only: findOpportunities, saveFeedback / clearFeedback, applyProposalUpdate
  ▼
Next.js 16 on Vercel (App Router, Server Components, fra1)
  ├─ lib/proposales/      API client (Zod schemas strip customer PII; the only place that calls Proposales)
  ├─ lib/proposals/       proposal model, draft update planner (pure) + service (the only writes)
  ├─ lib/catalog/         content library + rate card join, product status in a proposal
  ├─ lib/recommendations/ prompt, Zod output schema, deterministic validation, mock mode
  ├─ lib/revenue/         value and totals in integer cents (pure)
  └─ lib/feedback/        feedback schema (pure) + store
        │                         │                          │
        ▼                         ▼                          ▼
  Proposales REST API     OpenAI gpt-5-mini (Vercel AI SDK)   Postgres on Neon (fra1)
```

- All API keys stay on the server; the browser only calls server actions, which validate their
  input with Zod and re-derive everything (prices, line items) from fresh server-side data.
- Business logic is pure and unit-tested (`lib/**`, 106 tests); UI lives in `app/` and
  `components/` (a small design-token UI library in `components/ui/`).

## How the LLM is used

The AI part runs on the **Vercel AI SDK** (the `ai` package, with its `@ai-sdk/openai`
provider), calling **OpenAI `gpt-5-mini`** directly with the project's own OpenAI key (not
through the Vercel AI Gateway). The model is configurable via `OPENAI_MODEL`, and everything
runs server-side (`lib/recommendations/`).

- **Structured output.** `generateText` with `Output.object` and a Zod schema
  (`modelOutputSchema`). Each suggestion has a type (cross-sell / upgrade / extension), a
  catalog product id, the line item it relates to, a quantity with a short breakdown
  ("20 rooms × 1 night"), an explanation for the salesperson, a qualitative fit, and the
  suggestions it conflicts with. There are no price fields, so the model can't supply prices.
- **The prompt** contains only what the AI needs: the event facts (type, guests, dates, days,
  nights), the line items, the hotel catalog with list prices, and the dismissals the
  salesperson already gave for this proposal, with their reason. No customer names, emails or
  free-text comments.
- **Guardrails in code** (`validateRecommendations`): unknown products or line items, cross-sells
  already in the proposal, upgrades in another category or not more expensive, invalid
  quantities, duplicates and anything beyond three are dropped. Conflicts are linked both ways,
  so alternatives can't both be added. The quantity breakdown is shown only if its numbers
  multiply to the quantity. "No suggestions" is a valid answer.
- **Values are calculated in code**, never by the model: list price × quantity (or the price
  difference for upgrades), in integer cents.
- **Settings:** low reasoning effort, one retry, a 90-second timeout. A measured live run
  (Tech Summit) took 8.8 seconds. Errors (not configured, unusable answer, provider down) are
  shown as clear messages.
- **Mock mode** (`RECOMMENDATIONS_MODE=mock`) returns deterministic suggestions built from the
  real proposal and catalog, for UI work without API calls or cost.

## Key decisions

- **The AI chooses, code calculates.** The model returns product ids, quantities and an
  explanation, never prices. Every suggestion is validated against the real catalog and the
  proposal (unknown ids, wrong categories, upgrades that aren't more expensive, duplicates and
  conflicting alternatives are dropped or linked). Values use list prices × quantity, in integer
  cents, on the proposal's own VAT basis.
- **Optional extras, never edits.** The draft update re-sends every existing block unchanged and
  appends optional blocks, so the customer decides. Only drafts are updated; nothing is sent.
- **Upgrades as supplement products.** Proposales takes block titles from the content library
  and has no either/or between blocks, so an upgrade is a supplement product priced at the
  difference, created once in the library and hidden from the catalog and the AI.
- **Feedback in Postgres (Neon).** It must survive deploys, be shared by the team and be
  queryable. Dismissal reasons are fed into the next prompt; free-text comments never are,
  because they may name the customer.
- **Privacy.** Customer PII (recipient, contact, signatures) is stripped at the API boundary
  and never reaches logs, the UI or the model.

## Limitations

- **List prices come from an app rate card** (`data/rate-card.json`), because the Proposales
  catalog API exposes no prices, product types or units. The seed script generates it.
- The proposal search API returns at most the 25 most recently updated proposals and has no
  pagination.
- Opportunities are priced at list price; discounts, availability and seasonality aren't known.
- Proposals that aren't drafts can't be updated through the API; suggestions are advice there.
- No user accounts: one shared password on a login page guards every page and server action
  (`proxy.ts` checks a signed, `httpOnly` session cookie valid for 7 days), because the app
  spends money (each "Find opportunities" is a paid OpenAI call, capped by the OpenAI project's
  spending limit) and writes to Proposales drafts.

## Run it locally

Requires Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev                  # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `PROPOSALES_API_KEY` | yes | Proposales API token (server only) |
| `OPENAI_API_KEY` | yes, unless mock mode | OpenAI key for suggestions |
| `DATABASE_URL` | in production | Neon Postgres for feedback. Locally, use a separate Neon branch (below); without it, development keeps feedback in memory |
| `OPENAI_MODEL` | no | Defaults to `gpt-5-mini` |
| `RECOMMENDATIONS_MODE` | no | `mock` returns fake suggestions without calling OpenAI (for UI work); default `live` |
| `APP_PASSWORD` | in production | Shared password for the login page. Without it, production refuses every request; locally the login is skipped |

Checks: `npm run typecheck`, `npm run lint`, `npm test` (Vitest), `npm run build`.

### Database for local development

Production uses the `main` branch of the Neon database. Keep local test clicks out of it with
a branch of its own:

1. In the Neon console (Vercel → Storage → the database → Open in Neon): **Branches → Create
   branch**, name `dev`, parent `main`, "Branch data and schema".
2. **Connect** → select branch `dev` → copy the (pooled) connection string.
3. Set it as `DATABASE_URL` in `.env.local` and restart `npm run dev`.

The app creates its `recommendation_feedback` table on first use, so no migration is needed.

### Test data

To seed an empty Proposales test account (EUR company):

```bash
npm run seed            # dry run: prints what would be created
npm run seed -- --apply # creates 12 products and 4 draft proposals (no recipients, never sent)
```

The script is idempotent and regenerates `data/rate-card.json` with your account's product IDs.
`npm run seed -- --rate-card` regenerates the rate card without creating anything.

## Deployment

Vercel, from `main`. Functions run in Frankfurt (`fra1`, `vercel.json`) next to the Neon
database (branch `main`). Production needs `PROPOSALES_API_KEY`, `OPENAI_API_KEY` and
`DATABASE_URL` (added by the Neon integration); `RECOMMENDATIONS_MODE` must be unset or
`live`, and `APP_PASSWORD` must be set. The password covers the production domain; Vercel
Deployment Protection additionally covers the individual deployment URLs.

Every deployment URL keeps serving the build it was made from; use the production domain
(https://proposales-technical-case.vercel.app), which always points to the latest.

## Future improvements

- Use feedback across proposals (acceptance rates per product) to rank and tune suggestions.
- A display toggle for prices incl. / excl. VAT.
- Manager analytics: accepted and dismissed opportunities, revenue added to drafts.
- Batch analysis of all open proposals.

## Documentation

- [Product requirements](docs/PRODUCT.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md), step by step, with decisions and a change log
- [API findings](docs/API_FINDINGS.md): verified Proposales API behaviour, including live write tests
- [Proposales OpenAPI spec](https://docs.proposales.com/openapi.json), local snapshot in
  [docs/proposales-openapi.json](docs/proposales-openapi.json)
- [Engineering guidelines for Claude Code](CLAUDE.md)
