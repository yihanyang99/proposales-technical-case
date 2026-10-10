"use server";

import { z } from "zod";
import { feedbackInputSchema, feedbackKeySchema, toFeedbackRecord, type Decision } from "@/lib/feedback/model";
import { FeedbackStoreError, getFeedbackStore } from "@/lib/feedback/store";
import { ProposalesApiError } from "@/lib/proposales/client";
import { describeError, isNotFound } from "@/lib/proposales/errors";
import { applyDraftUpdate } from "@/lib/proposals/draft-service";
import type { DraftPlanError } from "@/lib/proposals/draft-update";
import { generateRecommendations, RecommendationError } from "@/lib/recommendations/engine";
import type { Confidence, RecommendationType } from "@/lib/recommendations/model";
import { RECOMMENDATION_TYPES } from "@/lib/recommendations/model";
import { MAX_QUANTITY, MIN_QUANTITY, type PricedOpportunity } from "@/lib/revenue/simulation";

export type RecommendationView = {
  id: string;
  type: RecommendationType;
  /** Catalog variation id of the suggested product. */
  productId: number;
  productTitle: string;
  productDescription: string | null;
  /** Line item being upgraded or extended. */
  lineItemId: string | null;
  lineItemTitle: string | null;
  quantity: number;
  /** Highest quantity the salesperson may set (an upgrade can't exceed the booked units). */
  maxQuantity: number;
  unit: string | null;
  quantityLabel: string | null;
  explanation: string;
  confidence: Confidence;
  /** Ids of alternatives that can't be included together with this one. */
  conflictsWith: string[];
  /**
   * Potential additional revenue (minor units) and the numbers it was calculated from, on the
   * proposal's own VAT basis (like its line items).
   */
  uplift: {
    amount: number;
    vatIncluded: boolean;
    currency: string;
    quantity: number;
    unitPrice: number;
    replacedUnitPrice: number | null;
    vatRate: number | null;
    /** The same prices on both VAT bases, for the simulation's VAT breakdown. */
    exclVat: PricedOpportunity;
    inclVat: PricedOpportunity;
  } | null;
};

export type RecommendationsState =
  | { status: "idle" }
  | {
      status: "done";
      runId: string;
      recommendations: RecommendationView[];
      droppedCount: number;
      /** Earlier decisions by recommendation id. */
      decisions: Record<string, Decision>;
    }
  | { status: "error"; message: string };

const inputSchema = z.object({ proposalUuid: z.guid() });

export async function findOpportunities(_previous: RecommendationsState, formData: FormData): Promise<RecommendationsState> {
  const input = inputSchema.safeParse({ proposalUuid: formData.get("proposalUuid") });
  if (!input.success) return { status: "error", message: "Invalid proposal." };

  try {
    const { proposal, recommendations, droppedCount, feedback } = await generateRecommendations(input.data.proposalUuid);
    const incl = proposal.vatIncluded;
    return {
      status: "done",
      runId: crypto.randomUUID(),
      droppedCount,
      decisions: Object.fromEntries(feedback.map((record) => [record.recommendationId, record.decision])),
      recommendations: recommendations.map((r) => ({
        id: r.id,
        type: r.type,
        productId: r.product.variationId,
        productTitle: r.product.title,
        productDescription: r.product.description,
        lineItemId: r.lineItem?.id ?? null,
        lineItemTitle: r.lineItem?.title ?? null,
        quantity: r.quantity,
        maxQuantity: r.type === "upgrade" ? (r.lineItem?.quantity ?? r.quantity) : MAX_QUANTITY,
        unit: r.product.price?.unit ?? null,
        quantityLabel: r.quantityLabel,
        explanation: r.explanation,
        confidence: r.confidence,
        conflictsWith: r.conflictsWith,
        uplift: r.uplift && {
          amount: incl ? r.uplift.amountInclVat : r.uplift.amountExclVat,
          vatIncluded: incl,
          currency: r.uplift.currency,
          quantity: r.uplift.quantity,
          unitPrice: incl ? r.uplift.unitPriceInclVat : r.uplift.unitPriceExclVat,
          replacedUnitPrice: incl ? r.uplift.replacedUnitPriceInclVat : r.uplift.replacedUnitPriceExclVat,
          vatRate: r.uplift.vatRate,
          exclVat: { unitPrice: r.uplift.unitPriceExclVat, replacedUnitPrice: r.uplift.replacedUnitPriceExclVat },
          inclVat: { unitPrice: r.uplift.unitPriceInclVat, replacedUnitPrice: r.uplift.replacedUnitPriceInclVat },
        },
      })),
    };
  } catch (error) {
    if (error instanceof RecommendationError) {
      const message =
        error.kind === "not_configured"
          ? "AI recommendations are not configured. Set OPENAI_API_KEY on the server."
          : error.kind === "invalid_model_output"
            ? "The AI returned an answer we could not use. Please try again."
            : "The AI service is unavailable right now. Please try again.";
      return { status: "error", message };
    }
    if (isNotFound(error)) return { status: "error", message: "This proposal no longer exists." };
    return { status: "error", message: describeError(error) };
  }
}

export type FeedbackResult = { ok: true } | { ok: false; message: string };

function feedbackError(error: unknown): FeedbackResult {
  if (error instanceof FeedbackStoreError && error.kind === "not_configured") {
    return { ok: false, message: "Feedback storage is not configured. Set DATABASE_URL on the server." };
  }
  return { ok: false, message: "Your decision could not be saved. Please try again." };
}

/** Stores an accept or dismiss decision. Input comes from the browser, so it is validated in full. */
export async function saveFeedback(input: unknown): Promise<FeedbackResult> {
  const parsed = feedbackInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid feedback." };
  try {
    await getFeedbackStore().save(toFeedbackRecord(parsed.data, new Date()));
    return { ok: true };
  } catch (error) {
    return feedbackError(error);
  }
}

/** Removes a decision (undo, or an alternative that was accepted instead). */
export async function clearFeedback(input: unknown): Promise<FeedbackResult> {
  const parsed = feedbackKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid feedback." };
  try {
    await getFeedbackStore().remove(parsed.data.proposalUuid, parsed.data.recommendationId);
    return { ok: true };
  } catch (error) {
    return feedbackError(error);
  }
}

const draftUpdateSchema = z.object({
  proposalUuid: z.guid(),
  items: z
    .array(
      z.object({
        type: z.enum(RECOMMENDATION_TYPES),
        productId: z.number().int().positive(),
        lineItemId: z.string().max(100).nullable(),
        quantity: z.number().int().min(MIN_QUANTITY).max(MAX_QUANTITY),
      }),
    )
    .min(1)
    .max(3),
});

const DRAFT_ERROR_MESSAGE: Record<DraftPlanError, string> = {
  not_a_draft: "Only draft proposals can be updated. Create a new version in Proposales first.",
  unknown_product: "A product is no longer in the hotel catalog. Find opportunities again.",
  unknown_line_item: "The proposal has changed in Proposales. Find opportunities again.",
  already_in_proposal: "A product is already in the proposal. Find opportunities again.",
  line_item_mismatch: "The proposal has changed in Proposales. Find opportunities again.",
  price_unavailable: "A product has no list price, so it can't be added.",
  currency_mismatch: "A product is priced in a different currency than the proposal.",
  invalid_quantity: "A quantity is not valid.",
  not_an_upgrade: "An upgrade is no longer more expensive than the current item. Find opportunities again.",
  conflicting_changes: "Two upgrades are for the same line. Keep only one of them.",
};

export type DraftApplyResult = { ok: true } | { ok: false; message: string };

function draftApiError(error: unknown): { ok: false; message: string } {
  if (error instanceof ProposalesApiError && error.kind === "conflict") {
    return { ok: false, message: "Proposales can't update this proposal right now (it may no longer be a draft). Reload and try again." };
  }
  if (isNotFound(error)) return { ok: false, message: "This proposal no longer exists." };
  return { ok: false, message: describeError(error) };
}

/**
 * Writes the confirmed change to the draft in Proposales. Called only from the confirmation
 * step; it never sends or publishes the proposal.
 */
export async function applyProposalUpdate(input: unknown): Promise<DraftApplyResult> {
  const parsed = draftUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid update." };
  try {
    const result = await applyDraftUpdate(parsed.data.proposalUuid, parsed.data.items);
    return result.ok ? result : { ok: false, message: DRAFT_ERROR_MESSAGE[result.error] };
  } catch (error) {
    return draftApiError(error);
  }
}
