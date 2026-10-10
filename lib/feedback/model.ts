import { z } from "zod";
import { CONFIDENCE_LEVELS, RECOMMENDATION_TYPES, type Confidence, type RecommendationType } from "@/lib/recommendations/model";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/revenue/simulation";

// Salesperson feedback on AI suggestions. Pure and browser-safe: the schema validates what the
// browser sends, and the decision helpers drive the panel's state.

export const DISMISS_REASONS = ["already_included", "strict_budget", "not_relevant", "unavailable", "other"] as const;
export type DismissReason = (typeof DISMISS_REASONS)[number];

export const DISMISS_REASON_LABEL: Record<DismissReason, string> = {
  already_included: "Already included in another package",
  strict_budget: "Customer has a strict budget",
  not_relevant: "Not relevant to this event",
  unavailable: "Product is unavailable",
  other: "Other",
};

export const MAX_COMMENT_LENGTH = 500;

const quantitySchema = z.number().int().min(MIN_QUANTITY).max(MAX_QUANTITY);

export const decisionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("accepted"), quantity: quantitySchema }),
  z.object({
    status: z.literal("dismissed"),
    reason: z.enum(DISMISS_REASONS),
    comment: z
      .string()
      .trim()
      .max(MAX_COMMENT_LENGTH)
      .nullable()
      .transform((comment) => comment || null),
  }),
]);

export type Decision = z.infer<typeof decisionSchema>;

/** Identifies one suggestion within a proposal, e.g. "upgrade:190483:<line item uuid>". */
const recommendationIdSchema = z.string().max(120).regex(/^(cross_sell|upgrade|extension):\d+:[\w-]*$/);

export const feedbackKeySchema = z.object({
  proposalUuid: z.guid(),
  recommendationId: recommendationIdSchema,
});

export const feedbackInputSchema = feedbackKeySchema
  .extend({
    type: z.enum(RECOMMENDATION_TYPES),
    productId: z.number().int().positive(),
    suggestedQuantity: quantitySchema,
    confidence: z.enum(CONFIDENCE_LEVELS),
    decision: decisionSchema,
  })
  .refine((input) => input.recommendationId.startsWith(`${input.type}:${input.productId}:`), {
    message: "recommendationId does not match type and productId",
    path: ["recommendationId"],
  });

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

/**
 * One stored decision. Holds no customer data: ids, the AI's suggestion and the salesperson's
 * answer. The accepted quantity next to the suggested one shows how often the AI is corrected.
 */
export type FeedbackRecord = {
  proposalUuid: string;
  recommendationId: string;
  type: RecommendationType;
  productId: number;
  suggestedQuantity: number;
  confidence: Confidence;
  decision: Decision;
  updatedAt: string;
};

export function toFeedbackRecord(input: FeedbackInput, now: Date): FeedbackRecord {
  const { proposalUuid, recommendationId, type, productId, suggestedQuantity, confidence, decision } = input;
  return { proposalUuid, recommendationId, type, productId, suggestedQuantity, confidence, decision, updatedAt: now.toISOString() };
}

/** Panel state for one suggestion. `dismissing` means the reason form is open. */
export type Choice =
  | { status: "pending"; quantity: number; dismissing: boolean }
  | { status: "accepted"; quantity: number }
  | { status: "dismissed"; quantity: number; reason: DismissReason; comment: string | null };

/** Starting state for a suggestion, restored from an earlier decision when there is one. */
export function initialChoice(suggestedQuantity: number, maxQuantity: number, saved: Decision | undefined): Choice {
  if (saved?.status === "accepted") return { status: "accepted", quantity: Math.min(saved.quantity, maxQuantity) };
  if (saved?.status === "dismissed") {
    return { status: "dismissed", quantity: suggestedQuantity, reason: saved.reason, comment: saved.comment };
  }
  return { status: "pending", quantity: suggestedQuantity, dismissing: false };
}

/**
 * Accepts one suggestion. Accepted alternatives go back to pending, because only one of them can
 * be part of the deal; `reopened` lists them so their stored decisions can be cleared.
 */
export function acceptChoice(
  choices: Record<string, Choice>,
  id: string,
  conflictsWith: string[],
): { choices: Record<string, Choice>; reopened: string[] } {
  const next: Record<string, Choice> = { ...choices, [id]: { status: "accepted", quantity: choices[id].quantity } };
  const reopened: string[] = [];
  for (const other of conflictsWith) {
    const choice = next[other];
    if (choice?.status === "accepted") {
      next[other] = { status: "pending", quantity: choice.quantity, dismissing: false };
      reopened.push(other);
    }
  }
  return { choices: next, reopened };
}

export type PromptDismissal = { productId: number; type: RecommendationType; reason: string };

/** What the next prompt learns about earlier dismissals: product and reason, never the comment. */
export function dismissalsForPrompt(records: FeedbackRecord[]): PromptDismissal[] {
  return records.flatMap((record) =>
    record.decision.status === "dismissed"
      ? [{ productId: record.productId, type: record.type, reason: DISMISS_REASON_LABEL[record.decision.reason] }]
      : [],
  );
}
