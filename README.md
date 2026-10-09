# Revenue Copilot

An AI-powered revenue optimization assistant for hotel sales teams using
[Proposales](https://proposales.com).

> **Status:** Planning only. Implementation has not started yet, and none of the
> functionality described below exists.

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
| 1–9 — Implementation | TODO |

See the implementation plan for details.

## Documentation

- [Product requirements](docs/PRODUCT.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [API findings](docs/API_FINDINGS.md) (template; not yet investigated)
- [Engineering guidelines for Claude Code](CLAUDE.md)
