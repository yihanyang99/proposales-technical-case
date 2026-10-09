"use client";

import { useActionState } from "react";
import { findOpportunities, type RecommendationsState, type RecommendationView } from "@/app/proposals/[uuid]/actions";
import { Alert, Badge, Button, Card, EmptyState, LevelBars, SectionTitle, Spinner } from "@/components/ui";
import { formatMoney, formatPercent } from "@/lib/format";

const TYPE_LABEL: Record<RecommendationView["type"], string> = {
  cross_sell: "Cross-sell",
  upgrade: "Upgrade",
  extension: "Extension",
};

const CONFIDENCE_LEVEL: Record<RecommendationView["confidence"], number> = { low: 1, medium: 2, high: 3 };

const CONFIDENCE_LABEL: Record<RecommendationView["confidence"], string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function RecommendationsPanel({ proposalUuid }: { proposalUuid: string }) {
  const [state, action, pending] = useActionState<RecommendationsState, FormData>(findOpportunities, { status: "idle" });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle className="mb-0">Revenue opportunities</SectionTitle>
        <form action={action} className="-my-1 flex">
          <input type="hidden" name="proposalUuid" value={proposalUuid} />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <>
                <Spinner />
                Analyzing…
              </>
            ) : state.status === "idle" ? (
              "Find opportunities"
            ) : (
              "Find again"
            )}
          </Button>
        </form>
      </div>

      {pending ? (
        <EmptyState>
          <span role="status" className="inline-flex items-center gap-2">
            <Spinner className="text-heading" />
            Reviewing the proposal against the hotel catalog…
          </span>
        </EmptyState>
      ) : state.status === "idle" ? (
        <EmptyState>Let the AI review this proposal against the hotel catalog and suggest up to three opportunities.</EmptyState>
      ) : state.status === "error" ? (
        <Alert title="Could not find opportunities">{state.message}</Alert>
      ) : state.recommendations.length === 0 ? (
        <EmptyState>No suitable opportunities found for this proposal.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {state.recommendations.map((recommendation) => (
            <li key={recommendation.id}>
              <RecommendationCard recommendation={recommendation} />
            </li>
          ))}
        </ul>
      )}

      {!pending && state.status === "done" && (
        <p className="text-xs text-muted">
          Suggested by AI from this proposal and the hotel catalog. Values are potential revenue at list price. Review
          before adding.
        </p>
      )}
    </section>
  );
}

function formatCalculation(
  uplift: NonNullable<RecommendationView["uplift"]>,
  quantityLabel: string | null,
  unit: string | null,
): string {
  const money = (minor: number) => formatMoney(minor, uplift.currency);
  const quantity = quantityLabel ?? String(uplift.quantity);
  const price =
    uplift.replacedUnitPrice === null
      ? money(uplift.unitPrice)
      : `(${money(uplift.unitPrice)} − ${money(uplift.replacedUnitPrice)})`;
  return `${quantity} × ${price}${unit ? ` / ${unit}` : ""}`;
}

function RecommendationCard({ recommendation: r }: { recommendation: RecommendationView }) {
  const added = r.quantityLabel ?? `${r.quantity}${r.unit ? ` ${r.unit}` : ""}`;
  const title =
    r.type === "cross_sell"
      ? `Add ${r.productTitle}`
      : r.type === "upgrade"
        ? `Upgrade ${r.lineItemTitle ?? "current item"} to ${r.productTitle}`
        : `Extend ${r.productTitle} by ${added}`;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="strong">{TYPE_LABEL[r.type]}</Badge>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted" title="Qualitative fit, not a likelihood of purchase">
          <LevelBars level={CONFIDENCE_LEVEL[r.confidence]} />
          {CONFIDENCE_LABEL[r.confidence]}
        </span>
      </div>
      <p className="mt-3 font-medium text-heading">{title}</p>
      <p className="mt-1 text-sm">{r.explanation}</p>
      <div className="mt-4">
        {r.uplift ? (
          <>
            <p className="text-sm text-body tabular-nums">{formatCalculation(r.uplift, r.quantityLabel, r.unit)}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-4xl font-medium tracking-[-0.02em] text-heading tabular-nums">
                {formatMoney(r.uplift.amount, r.uplift.currency)}
              </span>
              <span className="text-sm text-muted">
                {r.uplift.vatIncluded ? "incl." : "excl."}
                {r.uplift.vatRate !== null ? ` ${formatPercent(r.uplift.vatRate)}` : ""} VAT
              </span>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-body">
              {r.quantityLabel ?? r.quantity}
              {r.unit ? ` × ${r.unit}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted">Value unavailable: no list price</p>
          </>
        )}
      </div>
    </Card>
  );
}
