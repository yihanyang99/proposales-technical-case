import { describe, expect, it } from "vitest";
import type { ProposalBlock } from "@/lib/proposales/schemas";
import { deriveVatRate, filterProposals, parseProposalFilters, toEventContext, toLineItem, type ProposalSummary } from "./model";

describe("toLineItem", () => {
  const block: ProposalBlock = {
    uuid: "b1",
    type: "product-block",
    content_id: 190482,
    title: "Standard Double Room",
    currency: "EUR",
    quantity: 40,
    unit_value_with_discount_without_tax: 14500,
    unit_value_with_discount_with_tax: 16240,
  };

  it("computes totals and the VAT rate from the block prices", () => {
    expect(toLineItem(block)).toMatchObject({
      variationId: 190482,
      totalExclVat: 580000,
      totalInclVat: 649600,
      vatRate: 0.12,
      kind: "product",
    });
  });

  it("skips non-product blocks such as videos", () => {
    expect(toLineItem({ ...block, type: "video-block" })).toBeNull();
  });

  it("keeps a missing price as null instead of 0", () => {
    const item = toLineItem({ ...block, unit_value_with_discount_without_tax: null });
    expect(item?.unitPriceExclVat).toBeNull();
    expect(item?.totalExclVat).toBeNull();
  });
});

describe("deriveVatRate", () => {
  it("rounds to 0.1 percentage point", () => {
    expect(deriveVatRate(900, 1008)).toBe(0.12);
    expect(deriveVatRate(45000, 56250)).toBe(0.25);
  });

  it("is null without a usable base", () => {
    expect(deriveVatRate(null, 100)).toBeNull();
    expect(deriveVatRate(0, 0)).toBeNull();
  });
});

describe("toEventContext", () => {
  it("parses each field independently, so one bad value never hides the others", () => {
    expect(toEventContext({ event_type: "conference", guests: "80", event_start: "not-a-date", event_end: "2026-11-13" })).toEqual({
      eventType: "conference",
      guests: 80,
      startDate: null,
      endDate: "2026-11-13",
    });
  });

  it("returns empty context for missing metadata", () => {
    expect(toEventContext({})).toEqual({ eventType: null, guests: null, startDate: null, endDate: null });
  });
});

describe("proposal filters", () => {
  const summary = (title: string, status: ProposalSummary["status"]): ProposalSummary => ({
    uuid: title,
    title,
    status,
    updatedAt: 0,
    event: { eventType: null, guests: null, startDate: null, endDate: null },
  });
  const proposals = [summary("Summer Wedding", "draft"), summary("Tech Summit", "accepted")];

  it("matches titles case-insensitively and by status", () => {
    expect(filterProposals(proposals, { query: "wedding", status: null }).map((p) => p.title)).toEqual(["Summer Wedding"]);
    expect(filterProposals(proposals, { query: "", status: "accepted" }).map((p) => p.title)).toEqual(["Tech Summit"]);
  });

  it("ignores unknown statuses and caps the query length", () => {
    expect(parseProposalFilters({ status: "bogus", q: "x".repeat(200) })).toEqual({ query: "x".repeat(100), status: null });
  });
});
