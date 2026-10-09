# Revenue Copilot

An AI-powered revenue optimization assistant for hotel sales teams using
[Proposales](https://proposales.com).

> **Status:** Early development. The Next.js project and a read-only Proposales API client
> are in place, but none of the product functionality described below exists yet.

## What it is

Revenue Copilot analyzes existing Proposales proposals against the hotel's real product
catalog. It suggests up to three relevant revenue opportunities (cross-sells, upgrades and
extensions) and explains each one. Salespeople accept or dismiss each suggestion, give a
reason when dismissing, and see a deterministic estimate of the potential additional revenue.

It complements Proposales' existing proposal creation, digital proposal and e-signing
workflows. It does not replace them, and it never sends or publishes proposals.

## Problem

Salespeople often miss relevant cross-sell, upgrade and extension opportunities when building
event proposals, because spotting them depends on experience and catalog knowledge. That
means lost revenue per booking. Revenue Copilot makes these opportunities visible, explains
them, and leaves the salesperson in control.

## Planned technology stack

- TypeScript, React, Next.js (App Router), Node.js
- Tailwind CSS
- Vercel AI SDK with Zod-validated structured output
- Proposales REST API (server-side only)
- Vercel for deployment
- PostgreSQL only if persistent feedback storage is justified

## Current development status

| Step | Status |
|------|--------|
| 0 — Project Documentation | DONE |
| 1 — Next.js Initialization | DONE |
| 2 — Proposales API Investigation | DONE |
| 2a — Test Data Seeding | DONE |
| 3–9 — Features | TODO |

See the implementation plan for details.

## Local development

Requires Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local   # then fill in PROPOSALES_API_KEY
npm run dev                  # http://localhost:3000
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

### Test data

The app expects hotel products and event proposals in the Proposales account. To seed an
empty test account (EUR company):

```bash
npm run seed            # dry run: prints what would be created
npm run seed -- --apply # creates 12 products and 4 draft proposals (no recipients, never sent)
```

The script is idempotent, and it regenerates `data/rate-card.json` with the product IDs of
your account. The catalog API exposes no prices, product types or units, so the rate card
supplies them. `npm run seed -- --rate-card` regenerates the rate card without creating anything.

## Documentation

- [Product requirements](docs/PRODUCT.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [API findings](docs/API_FINDINGS.md)
- [Proposales OpenAPI spec](https://docs.proposales.com/openapi.json): the machine-readable
  API contract (OpenAPI 3.0); local snapshot in [docs/proposales-openapi.json](docs/proposales-openapi.json)
- [Engineering guidelines for Claude Code](CLAUDE.md)
