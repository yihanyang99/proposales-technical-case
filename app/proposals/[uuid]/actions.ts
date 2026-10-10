"use server";

import { z } from "zod";
import { feedbackInputSchema, feedbackKeySchema, toFeedbackRecord, type Decision } from "@/lib/feedback/model";
import { FeedbackStoreError, getFeedbackStore } from "@/lib/feedback/store";
import { describeError, isNotFound } from "@/lib/proposales/errors";
import { generateRecommendations, RecommendationError } from "@/lib/recommendations/engine";
import type { Confidence, RecommendationType } from "@/lib/recommendations/model";
import { MAX_QUANTITY, type PricedOpportunity } from "@/lib/revenue/simulation";

export type RecommendationView = {
  id: string;
  type: RecommendationType;
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
