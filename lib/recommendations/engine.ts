import "server-only";
import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { APICallError, generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from "ai";
import { getCatalog } from "@/lib/catalog/service";
import { dismissalsForPrompt, type FeedbackRecord } from "@/lib/feedback/model";
import { getFeedbackStore } from "@/lib/feedback/store";
import { getAiEnv, getRecommendationsMode } from "@/lib/env";
import { getProposalDetail } from "@/lib/proposals/service";
import type { ProposalDetail } from "@/lib/proposals/model";
import { calculateUplift, type Uplift } from "@/lib/revenue/uplift";
import { mockModelOutput } from "./mock";
import { modelOutputSchema, validateRecommendations, type ModelOutput, type Recommendation } from "./model";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";

export type RecommendationErrorKind = "not_configured" | "invalid_model_output" | "provider_error";

export class RecommendationError extends Error {
  constructor(
    message: string,
    readonly kind: RecommendationErrorKind,
  ) {
    super(message);
    this.name = "RecommendationError";
  }
}

export type ValuedRecommendation = Recommendation & {
  /** Potential additional revenue; null when it can't be calculated safely. */
  uplift: Uplift | null;
};

export type RecommendationResult = {
  proposal: ProposalDetail;
  recommendations: ValuedRecommendation[];
  mock: boolean;
  /** Number of model suggestions removed by validation (for transparency, no content). */
  droppedCount: number;
  /** Earlier decisions on this proposal's suggestions, to restore them in the panel. */
  feedback: FeedbackRecord[];
};

/** Earlier feedback is helpful context, not a requirement: a storage outage must not block suggestions. */
async function loadFeedback(proposalUuid: string): Promise<FeedbackRecord[]> {
  try {
    return await getFeedbackStore().listForProposal(proposalUuid);
  } catch {
    return [];
  }
}

/**
 * Loads the proposal and catalog server-side (never trusting client data), asks the model for
 * structured suggestions, and keeps only those that pass deterministic validation.
 */
export async function generateRecommendations(proposalUuid: string): Promise<RecommendationResult> {
  const mock = getRecommendationsMode() === "mock";
  let model: string | null = null;
  if (!mock) {
    try {
      ({ model } = getAiEnv());
    } catch {
      throw new RecommendationError("AI is not configured", "not_configured");
    }
  }

  const [proposal, feedback] = await Promise.all([getProposalDetail(proposalUuid), loadFeedback(proposalUuid)]);
  const catalog = await getCatalog(proposal.companyId, proposal.language);

  let output: ModelOutput;
  if (mock || !model) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    output = mockModelOutput(proposal, catalog.products);
  } else {
    try {
      ({ output } = await generateText({
        model: openai(model),
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt(proposal, catalog.products, dismissalsForPrompt(feedback)),
        output: Output.object({ schema: modelOutputSchema }),
        providerOptions: {
          openai: {
            reasoningEffort: "low",
            reasoningSummary: null,
          } satisfies OpenAILanguageModelResponsesOptions,
        },
        maxRetries: 1,
        timeout: 90_000,
      }));
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
        throw new RecommendationError("The AI returned an answer in an unexpected format", "invalid_model_output");
      }
      if (APICallError.isInstance(error) && (error.statusCode === 401 || error.statusCode === 403)) {
        throw new RecommendationError("AI is not configured", "not_configured");
      }
      throw new RecommendationError("The AI service is unavailable", "provider_error");
    }
  }

  const { recommendations, dropped } = validateRecommendations(output, {
    catalog: catalog.products,
    lineItems: proposal.lineItems,
  });
  const valued = recommendations.map((r) => ({
    ...r,
    uplift:
      r.type === "cross_sell"
        ? calculateUplift({ type: "cross_sell", product: r.product, quantity: r.quantity }, proposal.currency)
        : r.type === "extension"
          ? calculateUplift({ type: "extension", lineItem: r.lineItem!, quantity: r.quantity }, proposal.currency)
          : calculateUplift({ type: "upgrade", product: r.product, lineItem: r.lineItem!, quantity: r.quantity }, proposal.currency),
  }));
  return { proposal, recommendations: valued, mock, droppedCount: dropped.length, feedback };
}
