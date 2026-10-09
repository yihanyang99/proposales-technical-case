"use client";

import { useActionState, useState } from "react";
import { findOpportunities, type RecommendationsState, type RecommendationView } from "@/app/proposals/[uuid]/actions";
import { Alert, Badge, Button, Card, EmptyState, LevelBars, QuantityInput, SectionTitle, Spinner } from "@/components/ui";
import { formatMoney, formatPercent } from "@/lib/format";
import { describeExtension } from "@/lib/recommendations/model";
import { MIN_QUANTITY, opportunityAmount, simulateTotals } from "@/lib/revenue/simulation";

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

type PanelProps = {
  proposalUuid: string;
  /** Proposal total on its own VAT basis, minor units. */
  currentTotal: number | null;
  currency: string | null;
  vatIncluded: boolean;
};

export function RecommendationsPanel({ proposalUuid, currentTotal, currency, vatIncluded }: PanelProps) {
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
        <OpportunityList
          key={state.runId}
          recommendations={state.recommendations}
          currentTotal={currentTotal}
          currency={currency}
          vatIncluded={vatIncluded}
        />
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

type Choice = { selected: boolean; quantity: number };

function OpportunityList({
  recommendations,
  currentTotal,
  currency,
  vatIncluded,
}: { recommendations: RecommendationView[] } & Omit<PanelProps, "proposalUuid">) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(recommendations.map((r) => [r.id, { selected: false, quantity: r.quantity }])),
  );
  const update = (id: string, change: Partial<Choice>) =>
    setChoices((current) => ({ ...current, [id]: { ...current[id], ...change } }));

  const totals = simulateTotals(
    currentTotal,
    recommendations.map((r) => ({
      selected: choices[r.id].selected,
      amount: r.uplift ? opportunityAmount(r.uplift, choices[r.id].quantity) : null,
    })),
  );

  return (
    <>
      <ul className="space-y-3">
        {recommendations.map((recommendation) => (
          <li key={recommendation.id}>
            <RecommendationCard
              recommendation={recommendation}
              choice={choices[recommendation.id]}
              onChange={(change) => update(recommendation.id, change)}
            />
          </li>
        ))}
      </ul>
      {currency && <SimulationSummary totals={totals} currency={currency} vatIncluded={vatIncluded} />}
    </>
  );
}

function SimulationSummary({
  totals,
  currency,
  vatIncluded,
}: {
  totals: ReturnType<typeof simulateTotals>;
  currency: string;
  vatIncluded: boolean;
}) {
  const money = (minor: number | null) => formatMoney(minor, currency);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Simulation</h3>
        <span className="text-xs text-muted">{vatIncluded ? "incl." : "excl."} VAT</span>
      </div>
      {totals.selectedCount === 0 ? (
        <p className="mt-2 text-sm text-muted">Include opportunities above to see the potential proposal total.</p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-6 text-muted">
            <dt>Current proposal</dt>
            <dd className="tabular-nums">{money(totals.current)}</dd>
          </div>
          <div className="flex justify-between gap-6 text-muted">
            <dt>
              {totals.selectedCount} selected {totals.selectedCount === 1 ? "opportunity" : "opportunities"}
            </dt>
            <dd className="tabular-nums">+ {money(totals.added)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-t border-divider pt-3">
            <dt className="font-medium text-heading">Potential total</dt>
            <dd className="text-2xl font-medium tracking-[-0.01em] text-heading tabular-nums">{money(totals.potential)}</dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

function formatCalculation(uplift: NonNullable<RecommendationView["uplift"]>, quantity: number, unit: string | null): string {
  const money = (minor: number) => formatMoney(minor, uplift.currency);
  const price =
    uplift.replacedUnitPrice === null
      ? money(uplift.unitPrice)
      : `(${money(uplift.unitPrice)} − ${money(uplift.replacedUnitPrice)})`;
  return `${quantity} × ${price}${unit ? ` / ${unit}` : ""}`;
}

function RecommendationCard({
  recommendation: r,
  choice,
  onChange,
}: {
  recommendation: RecommendationView;
  choice: Choice;
  onChange: (change: Partial<Choice>) => void;
}) {
  const { quantity, selected } = choice;
  const suggestion = r.quantityLabel ?? `${r.quantity}${r.unit ? ` ${r.unit}` : ""}`;
  const edited = quantity !== r.quantity;
  const title =
    r.type === "cross_sell"
      ? `Add ${r.productTitle}`
      : r.type === "upgrade"
        ? `Upgrade ${r.lineItemTitle ?? "current item"} to ${r.productTitle}`
        : `Extend ${r.productTitle} ${describeExtension(quantity, r.unit, edited ? null : r.quantityLabel)}`;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="strong">{TYPE_LABEL[r.type]}</Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted" title="Qualitative fit, not a likelihood of purchase">
            <LevelBars level={CONFIDENCE_LEVEL[r.confidence]} />
            {CONFIDENCE_LABEL[r.confidence]}
          </span>
        </div>
        <Button
          size="sm"
          variant={selected ? "primary" : "secondary"}
          className={selected ? undefined : "bg-surface-1"}
          aria-pressed={selected}
          disabled={!r.uplift}
          onClick={() => onChange({ selected: !selected })}
        >
          {selected ? "Included" : "Include"}
        </Button>
      </div>
      <p className="mt-3 font-medium text-heading">{title}</p>
      <p className="mt-1 text-sm">{r.explanation}</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {r.uplift ? (
          <div>
            <p className="text-sm text-body tabular-nums">{formatCalculation(r.uplift, quantity, r.unit)}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-4xl font-medium tracking-[-0.02em] text-heading tabular-nums">
                {formatMoney(opportunityAmount(r.uplift, quantity), r.uplift.currency)}
              </span>
              <span className="text-sm text-muted">
                {r.uplift.vatIncluded ? "incl." : "excl."}
                {r.uplift.vatRate !== null ? ` ${formatPercent(r.uplift.vatRate)}` : ""} VAT
              </span>
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-body">
              {quantity}
              {r.unit ? ` × ${r.unit}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted">Value unavailable: no list price</p>
          </div>
        )}
        <div className="flex flex-col gap-1 sm:items-end">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>Quantity</span>
            <QuantityInput
              value={quantity}
              min={MIN_QUANTITY}
              max={r.maxQuantity}
              onChange={(value) => onChange({ quantity: value })}
              label={`quantity for ${r.productTitle}`}
            />
          </div>
          {edited ? (
            <button
              type="button"
              onClick={() => onChange({ quantity: r.quantity })}
              className="inline-flex items-center gap-1 rounded-full text-xs text-muted transition-colors hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Reset quantity to the suggested ${suggestion}`}
            >
              Suggested: {suggestion}
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
                <path d="M3 8a5 5 0 1 0 1.5-3.6M3 3v2.5h2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <p className="text-xs text-muted">Suggested: {suggestion}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
