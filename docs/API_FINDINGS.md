# Proposales API Findings

Investigation template, to be completed in **Step 2**.

- OpenAPI specification: https://docs.proposales.com/openapi.json. This is the complete,
  machine-readable API contract (OpenAPI 3.0). It can be imported into API clients, code
  generators and agent tooling.
- Local snapshot: [`docs/proposales-openapi.json`](proposales-openapi.json) (OpenAPI 3.0.3,
  spec version `2026.09.02`, downloaded 2026-10-09). Use the local copy for offline reference
  and agent tooling; re-download it if the upstream spec changes. The live API is the final
  authority.
- Base URL: https://api.proposales.com
- Authentication: Bearer token from the `PROPOSALES_API_KEY` environment variable (server-side only)

> Nothing in this document has been verified yet. Do not rely on any endpoint behavior or
> schema until a section is marked as verified. Record only behavior that has been confirmed
> against the specification and/or real (read-only) requests.

**Verification status values:**
- `Not yet verified.`
- `Verified (spec)`: confirmed in the OpenAPI specification only
- `Verified (live)`: confirmed with a real API request
- `Unsupported`: confirmed as not available

---

## Authentication

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Company Information

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Proposal Search

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Proposal Details

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Proposal Blocks

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Product Catalog

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Product Pricing

Includes currency, VAT basis (inclusive/exclusive) and units.

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Optional Products

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Draft Updates

Write operations require explicit user approval before they are tested.

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## Proposal Versioning

- **Endpoint:** Not yet verified.
- **Request parameters:** Not yet verified.
- **Response fields:** Not yet verified.
- **Relevant schemas:** Not yet verified.
- **Limitations:** Not yet verified.
- **Verification status:** Not yet verified.

## API Limitations

Covers rate limits, pagination, error formats and similar constraints.

- Not yet verified.

## Open Questions

To be answered during Step 2:

- How are proposals listed or searched, and is pagination supported?
- How is event context (date, duration, guest count, event type) represented in a proposal?
- How are line items represented (blocks, products, quantities)?
- Can proposal line items be reliably linked to catalog product IDs?
- Are prices VAT-inclusive or VAT-exclusive, and is this exposed explicitly?
- Can a single proposal or catalog contain multiple currencies?
- Does the API expose product availability?
- Does the API support "optional" products within a proposal?
- Can a proposal draft be updated safely without publishing or sending it?
- How does proposal versioning interact with updates?
