import type { CatalogProduct } from "@/lib/catalog/model";
import type { ProposalDetail } from "@/lib/proposals/model";
import type { ModelOutput } from "./model";

/**
 * Deterministic stand-in for the model (RECOMMENDATIONS_MODE=mock), built from the real proposal
 * and catalog so validation and revenue calculation run unchanged. Used to avoid API calls
 * during UI work.
 */
export function mockModelOutput(proposal: ProposalDetail, catalog: CatalogProduct[]): ModelOutput {
  const byVariation = new Map(catalog.map((p) => [p.variationId, p]));
  const inProposal = new Set(proposal.lineItems.map((l) => l.variationId));
  const guests = proposal.event.guests ?? 10;
  const recommendations: ModelOutput["recommendations"] = [];

  const candidates = catalog.filter((p) => p.price && !inProposal.has(p.variationId));
  const crossSell = candidates.find((p) => p.price?.unit === "person") ?? candidates[0];
  if (crossSell?.price) {
    const quantity = crossSell.price.unit === "person" ? guests : 1;
    recommendations.push({
      type: "cross_sell",
      productId: crossSell.variationId,
      lineItemId: null,
      quantity,
      quantityRationale: crossSell.price.unit === "person" ? `${guests} guests` : "1 unit",
      explanation: "Mock suggestion: complements this event and is not in the proposal yet.",
      confidence: "high",
      conflictsWith: [],
    });
  }

  for (const line of proposal.lineItems) {
    const current = line.variationId !== null ? byVariation.get(line.variationId) : undefined;
    const better = catalog
      .filter((p) => p.category && p.category === current?.category && p.variationId !== line.variationId)
      .filter((p) => (p.price?.unitPriceExclVat ?? 0) > (line.unitPriceExclVat ?? Infinity))
      .sort((a, b) => (a.price?.unitPriceExclVat ?? 0) - (b.price?.unitPriceExclVat ?? 0))[0];
    if (better) {
      recommendations.push({
        type: "upgrade",
        productId: better.variationId,
        lineItemId: line.id,
        quantity: line.quantity ?? 1,
        quantityRationale: `${line.quantity ?? 1} rooms`,
        explanation: "Mock suggestion: a better guest experience for a small step up in price.",
        confidence: "medium",
        conflictsWith: [],
      });
      break;
    }
  }

  const extendable = proposal.lineItems.find((l) => {
    const unit = l.variationId !== null ? byVariation.get(l.variationId)?.price?.unit : undefined;
    return unit === "night" || unit === "day";
  });
  if (extendable?.variationId) {
    recommendations.push({
      type: "extension",
      productId: extendable.variationId,
      lineItemId: extendable.id,
      quantity: Math.max(1, Math.round((extendable.quantity ?? 1) / 2)),
      quantityRationale: (() => {
        const extra = Math.max(1, Math.round((extendable.quantity ?? 1) / 2));
        const unit = byVariation.get(extendable.variationId)?.price?.unit;
        return unit === "night" ? `${extra} rooms × 1 night` : `${extra} ${extra === 1 ? "day" : "days"}`;
      })(),
      explanation: "Mock suggestion: lets guests arrive the evening before.",
      confidence: "low",
      conflictsWith: [],
    });
  }

  return { recommendations };
}
