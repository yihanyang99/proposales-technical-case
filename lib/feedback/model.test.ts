import { describe, expect, it } from "vitest";
import {
  acceptChoice,
  dismissalsForPrompt,
  feedbackInputSchema,
  initialChoice,
  toFeedbackRecord,
  type Choice,
} from "./model";

const UUID = "8838745d-74e2-4f66-8864-116f1731f6ab";

const input = (overrides: Record<string, unknown> = {}) => ({
  proposalUuid: UUID,
  recommendationId: "upgrade:190483:b1f0c2d4-0000-4000-8000-000000000001",
  type: "upgrade",
  productId: 190483,
  suggestedQuantity: 40,
  confidence: "medium",
  decision: { status: "accepted", quantity: 35 },
  ...overrides,
});

describe("feedbackInputSchema", () => {
  it("accepts an accepted decision with an edited quantity", () => {
    expect(feedbackInputSchema.safeParse(input()).success).toBe(true);
  });

  it("requires a known reason for a dismissal", () => {
    expect(feedbackInputSchema.safeParse(input({ decision: { status: "dismissed", comment: null } })).success).toBe(false);
    expect(
      feedbackInputSchema.safeParse(input({ decision: { status: "dismissed", reason: "too_expensive", comment: null } })).success,
    ).toBe(false);
  });

  it("trims the comment and stores a blank one as null", () => {
    const parsed = feedbackInputSchema.parse(input({ decision: { status: "dismissed", reason: "strict_budget", comment: "   " } }));
    expect(parsed.decision).toEqual({ status: "dismissed", reason: "strict_budget", comment: null });
  });

  it.each([
    ["a comment over 500 characters", { decision: { status: "dismissed", reason: "other", comment: "x".repeat(501) } }],
    ["a quantity of 0", { decision: { status: "accepted", quantity: 0 } }],
    ["a fractional quantity", { decision: { status: "accepted", quantity: 2.5 } }],
    ["an invalid proposal id", { proposalUuid: "not-a-uuid" }],
    ["an id that doesn't match the type", { type: "cross_sell" }],
    ["an id that doesn't match the product", { productId: 1 }],
    ["a malformed id", { recommendationId: "upgrade:190483:<script>" }],
  ])("rejects %s", (_name, overrides) => {
    expect(feedbackInputSchema.safeParse(input(overrides)).success).toBe(false);
  });
});

describe("initialChoice", () => {
  it("starts pending with the suggested quantity", () => {
    expect(initialChoice(40, 40, undefined)).toEqual({ status: "pending", quantity: 40, dismissing: false });
  });

  it("restores an accepted quantity, capped at the current maximum", () => {
    expect(initialChoice(40, 40, { status: "accepted", quantity: 35 })).toEqual({ status: "accepted", quantity: 35 });
    expect(initialChoice(30, 30, { status: "accepted", quantity: 35 })).toEqual({ status: "accepted", quantity: 30 });
  });

  it("restores a dismissal with its reason and comment", () => {
    expect(initialChoice(80, 10_000, { status: "dismissed", reason: "not_relevant", comment: "No spa" })).toEqual({
      status: "dismissed",
      quantity: 80,
      reason: "not_relevant",
      comment: "No spa",
    });
  });
});

describe("acceptChoice", () => {
  const choices: Record<string, Choice> = {
    a: { status: "pending", quantity: 40, dismissing: false },
    b: { status: "accepted", quantity: 40 },
    c: { status: "dismissed", quantity: 80, reason: "strict_budget", comment: null },
  };

  it("accepts and reopens an accepted alternative", () => {
    const { choices: next, reopened } = acceptChoice(choices, "a", ["b", "c"]);
    expect(next.a).toEqual({ status: "accepted", quantity: 40 });
    expect(next.b).toEqual({ status: "pending", quantity: 40, dismissing: false });
    expect(next.c).toBe(choices.c);
    expect(reopened).toEqual(["b"]);
  });

  it("leaves unrelated suggestions alone", () => {
    expect(acceptChoice(choices, "a", []).reopened).toEqual([]);
  });
});

describe("feedback records", () => {
  it("adds a timestamp and keeps only ids, quantities and the decision", () => {
    const record = toFeedbackRecord(feedbackInputSchema.parse(input()), new Date("2026-10-10T08:00:00Z"));
    expect(record).toEqual({
      proposalUuid: UUID,
      recommendationId: "upgrade:190483:b1f0c2d4-0000-4000-8000-000000000001",
      type: "upgrade",
      productId: 190483,
      suggestedQuantity: 40,
      confidence: "medium",
      decision: { status: "accepted", quantity: 35 },
      updatedAt: "2026-10-10T08:00:00.000Z",
    });
  });

  it("passes dismissal reasons to the prompt, never comments", () => {
    const dismissed = toFeedbackRecord(
      feedbackInputSchema.parse(
        input({
          recommendationId: "cross_sell:190491:",
          type: "cross_sell",
          productId: 190491,
          decision: { status: "dismissed", reason: "not_relevant", comment: "Client Anna Svensson hates spas" },
        }),
      ),
      new Date(),
    );
    const accepted = toFeedbackRecord(feedbackInputSchema.parse(input()), new Date());
    expect(dismissalsForPrompt([dismissed, accepted])).toEqual([
      { productId: 190491, type: "cross_sell", reason: "Not relevant to this event" },
    ]);
    expect(JSON.stringify(dismissalsForPrompt([dismissed]))).not.toContain("Anna");
  });
});
