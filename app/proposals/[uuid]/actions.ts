"use server";

import { z } from "zod";
import { describeError, isNotFound } from "@/lib/proposales/errors";
import { generateRecommendations, RecommendationError } from "@/lib/recommendations/engine";
import type { Confidence, RecommendationType } from "@/lib/recommendations/model";

export type RecommendationView = {
  id: string;
  type: RecommendationType;
  productTitle: string;
  productDescription: string | null;
  /** Line item being upgraded or extended. */
  lineItemTitle: string | null;
  quantity: number;
  unit: string | null;
  quantityLabel: string | null;
  explanation: string;
  confidence: Confidence;
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
  } | null;
};

export type RecommendationsState =
  | { status: "idle" }
  | { status: "done"; recommendations: RecommendationView[]; droppedCount: number }
  | { status: "error"; message: string };

const inputSchema = z.object({ proposalUuid: z.guid() });

export async function findOpportunities(_previous: RecommendationsState, formData: FormData): Promise<RecommendationsState> {
  const input = inputSchema.safeParse({ proposalUuid: formData.get("proposalUuid") });
  if (!input.success) return { status: "error", message: "Invalid proposal." };

  try {
    const { proposal, recommendations, droppedCount } = await generateRecommendations(input.data.proposalUuid);
    const incl = proposal.vatIncluded;
    return {
      status: "done",
      droppedCount,
      recommendations: recommendations.map((r) => ({
        id: r.id,
        type: r.type,
        productTitle: r.product.title,
        productDescription: r.product.description,
        lineItemTitle: r.lineItem?.title ?? null,
        quantity: r.quantity,
        unit: r.product.price?.unit ?? null,
        quantityLabel: r.quantityLabel,
        explanation: r.explanation,
        confidence: r.confidence,
        uplift: r.uplift && {
          amount: incl ? r.uplift.amountInclVat : r.uplift.amountExclVat,
          vatIncluded: incl,
          currency: r.uplift.currency,
          quantity: r.uplift.quantity,
          unitPrice: incl ? r.uplift.unitPriceInclVat : r.uplift.unitPriceExclVat,
          replacedUnitPrice: incl ? r.uplift.replacedUnitPriceInclVat : r.uplift.replacedUnitPriceExclVat,
          vatRate: r.uplift.vatRate,
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
