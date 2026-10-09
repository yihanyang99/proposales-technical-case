# CLAUDE.md — Revenue Copilot

Primary project instructions for Claude Code. Read this file before every step.

Revenue Copilot is an AI-powered revenue optimization assistant for hotel sales teams
using Proposales. It analyzes existing proposals and suggests up to three relevant revenue
opportunities (cross-sell, upgrade, extension). Salespeople accept or dismiss each one,
and the app shows the potential additional revenue. It complements Proposales' proposal
creation, digital proposal and e-signing workflows and does not duplicate them.

See `docs/PRODUCT.md` for product requirements and `docs/IMPLEMENTATION_PLAN.md` for the
step-by-step plan.

## Proposales API Reference

- The OpenAPI 3.0 contract is at https://docs.proposales.com/openapi.json, with a local
  snapshot in `docs/proposales-openapi.json`.
- Base URL: https://api.proposales.com. Authentication: Bearer token from `PROPOSALES_API_KEY`.
- Use the spec as the source for endpoints and schemas. Do not assume behavior that isn't in
  the spec or confirmed in `docs/API_FINDINGS.md`.
- Use the spec to derive Zod schemas; it may also be used for type generation if that is justified.
- Call the API only through `lib/proposales/client.ts`. Its schemas strip customer PII and
  tolerate known spec drift (see `docs/API_FINDINGS.md`).
- The catalog API has **no prices**. Cross-sell and upgrade prices come from the app rate card
  (`data/rate-card.json`); extension prices come from the proposal's own blocks.
- Never call write endpoints (`POST`/`PATCH`/`PUT`/`DELETE`) without explicit user approval
  for that specific run.

## Architecture

- Use a simple Next.js (App Router) full-stack architecture.
- Keep Proposales API requests server-side (Route Handlers / Server Actions / server-only modules).
- Keep LLM requests server-side.
- Separate business logic (`lib/`) from UI components (`app/`, `components/`).
- Prefer pure functions for revenue calculations.
- Use Zod for runtime validation of external data (Proposales responses, LLM output, request bodies).
- Avoid unnecessary abstraction layers.
- Prefer readable, maintainable TypeScript.

### Next.js version

- This project uses Next.js 16.4, which may differ from training data. Before using an
  unfamiliar API or convention, read the version-matched docs in `node_modules/next/dist/docs/`.
- `cacheComponents` is enabled: uncached dynamic data must be read inside `<Suspense>`, or
  cached explicitly with `"use cache"`. Check the docs before fetching data in pages.
- `agentRules: false` in `next.config.ts` stops `next dev` from generating `AGENTS.md`.
  This file is the single source of agent instructions.

### Layout and commands

- `app/`: routes and UI. `components/`: shared UI components. `lib/`: business logic and
  server-only modules (e.g. `lib/env.ts`).
- `lib/proposales/`: API client and response schemas. `lib/proposals/`: the internal proposal
  model (pure normalization) and the server-only service that the pages call.
- `lib/recommendations/`: model output schema, deterministic validation, prompt, mock mode and
  the server-only engine (OpenAI through the Vercel AI SDK; `gpt-5-mini` by default). The model
  never supplies prices. `lib/revenue/`: pure revenue math in integer cents.
- `RECOMMENDATIONS_MODE=mock` avoids OpenAI calls during UI work. Never run live AI calls
  without need; each costs money.
- `lib/catalog/`: rate card schema, pure catalog join (content library + rate card, matched on
  `variation_id`) and the server-only `getCatalog`. A product without a rate-card entry has
  `price: null`, never 0.
- Pages read `params`/`searchParams` and fetch data inside `<Suspense>`. Handle expected API
  errors inline (production hides error messages in `error.tsx`).
- Read server secrets through `getServerEnv()` in `lib/env.ts` (Zod-validated, `server-only`).
- Checks: `npm run typecheck`, `npm run lint`, `npm run build`. Dev server: `npm run dev`.
- Test data: `npm run seed` (dry run). `--apply` writes to Proposales and needs explicit approval for each run.

## UI Library

- Reusable UI lives in `components/ui/` (import from `@/components/ui`): `Button`/`buttonStyles`,
  `Input`, `FieldLabel`, `Card`/`cardStyles`, `Chip`/`ChipGroup`, `Badge`, `Dot`, `Alert`,
  `EmptyState`, `Skeleton`, `Page`, `PageHeader`, `SectionTitle`, `Table*` primitives, `Totals`, `Spinner`, `LevelBars`
  and `LocalDate` (timestamps in the viewer's time zone; never format timestamps in UTC on the server).
- Prefer chips (pill links or choices) over a native `<select>`: the open menu of a native select
  cannot be styled and looks browser-default.
- Pages and feature components compose these. Do not hand-style buttons, fields, cards, badges or
  tables in pages. If something is missing, add or extend a component in `components/ui/`.
- Styling comes from the design tokens in `app/globals.css` (Tailwind names such as `bg-surface-2`,
  `text-muted`, `bg-primary`). Never hard-code colours. The palette is sampled from proposales.com:
  page `#f9f9f9` (`surface-1`), white rounded surfaces (`surface-2`), black pill buttons, headings
  `#292929`, `subtle` `#919191` for **large** text only (small secondary text uses `muted` `#6b6b6b`
  for contrast), and `surface-inverse` `#111f1e` for dark sections. The visual language follows
  Proposales: a floating glass header bar (`surface-glass` + backdrop blur), **no borders** (separate with
  surface contrast and spacing; the only exception is the `divider` line above totals in `Totals`),
  no extra background fills for sub-sections, pill-shaped controls, monochrome, colour only for meaning
  (`success`, `failure`), Switzer font.
- Components accept `className` for layout tweaks (width, margin) and are combined with `cn()` from
  `lib/cn.ts`. `cn()` does not merge conflicting Tailwind classes, so keep overrides additive.
- Keep the library small: add a component when a step needs it, not in advance.
- Domain components built on the library (e.g. `StatusBadge`, `EventSummary`) live in `components/`.

## Security

- Never expose API keys to the browser. `PROPOSALES_API_KEY` and LLM keys are server-only;
  never prefix them with `NEXT_PUBLIC_`.
- Never commit secrets. Keep `.env*` files (except `.env.example`) out of Git.
- Use environment variables for all credentials and configuration.
- Never log sensitive customer information (names, emails, phone numbers, proposal contents).
- Validate incoming requests.
- Never automatically publish or send proposals.
- Require explicit user approval before any Proposales API write operation.

## AI Integration

- Use the Vercel AI SDK.
- Use structured output validated with Zod.
- Only recommend products that exist in the real hotel catalog returned by the Proposales API.
- Validate every model-selected product ID against the catalog; discard recommendations that
  reference unknown IDs.
- Never allow the LLM to invent prices. Prices always come from catalog data.
- Never let the LLM directly modify proposals.
- Support empty recommendations when no suitable opportunity exists.
- Treat confidence as qualitative (e.g. low / medium / high), not as a statistical
  probability of conversion.

## Revenue Calculations

- Revenue calculations must be deterministic and done in code, never by the LLM.
- Cross-sell uplift uses actual product pricing and appropriate quantities
  (e.g. guest count, nights, days, as supported by the data).
- Upgrade uplift is the difference between the replacement product and the existing product.
- Never mix currencies.
- Never mix VAT-inclusive and VAT-exclusive amounts.
- Handle missing pricing information explicitly (show "price unavailable", never assume 0).
- Clearly label revenue as **potential**, not guaranteed.

## Human-in-the-loop Feedback

Salespeople must be able to:

- Accept recommendations.
- Dismiss recommendations.
- Provide dismissal reasons.

Dismissal reasons:

- Already included in another package.
- Customer has a strict budget.
- Not relevant to this event.
- Product is unavailable.
- Other.

Allow an optional comment for additional context.

Feedback should be designed for future recommendation improvement (e.g. as context for
later prompts or analytics) without implementing model fine-tuning.

## Development Workflow

IMPORTANT:

Follow `docs/IMPLEMENTATION_PLAN.md`.

Only execute the step explicitly requested by the user.

Do not automatically proceed to subsequent steps.

Before implementing a step:

1. Read `CLAUDE.md`.
2. Read `docs/PRODUCT.md`.
3. Read `docs/IMPLEMENTATION_PLAN.md`.
4. Read `docs/API_FINDINGS.md` when relevant.
5. Inspect existing code before making changes.

After implementing a step:

1. Review the changes.
2. Run relevant checks (typecheck, lint, tests, build as applicable).
3. Verify acceptance criteria.
4. Update the implementation plan (status, notes, any plan changes).
5. Create one focused Git commit (after explicit user approval; see Git Rules).
6. Summarize the result.
7. Stop and wait for the next instruction.

## Git Rules

Use Conventional Commits:

- `feat:`
- `fix:`
- `docs:`
- `chore:`
- `refactor:`
- `test:`

Each step should produce one meaningful commit.

Before committing:

- Review `git status`.
- Review `git diff`.
- Verify no secrets are staged.
- Stage only relevant files.
- Do not commit unrelated changes.

Never force push.

Never rewrite Git history without explicit permission.

Do not create artificial commits just to increase the number of commits.

Note: the user's global instructions require explicit "yes" approval before any Git
operation that creates, edits or deletes anything (stage, commit, push, branch, etc.).
Ask before each such operation.

## Code Quality

- Use TypeScript with strict mode.
- Avoid `any` where practical.
- Keep React components focused.
- Handle loading, empty, and error states.
- Prefer simple solutions.
- Avoid premature optimization.
- Test critical business logic (revenue calculations, product ID validation).

## Scope Control

This is a small take-home assignment.

Target development time: approximately 4–5 hours, subject to API complexity.

Do not implement:

- Complex authentication systems.
- Microservices.
- Multi-agent orchestration.
- Vector databases.
- Model fine-tuning.
- Custom e-signing.
- Customer-facing proposal editors.
- Dynamic pricing engines.
- Unnecessary infrastructure.

PostgreSQL may be introduced only if persistent recommendation feedback is justified.
MCP is optional and should only be introduced if it solves a real integration problem.
