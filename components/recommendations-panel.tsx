"use client";

import { useActionState, useState } from "react";
import { findOpportunities, type RecommendationsState, type RecommendationView } from "@/app/proposals/[uuid]/actions";
import { Alert, Badge, Button, Card, EmptyState, LevelBars, QuantityInput, SectionTitle, Spinner } from "@/components/ui";
import { formatMoney, formatPercent } from "@/lib/format";
import { MIN_QUANTITY, opportunityAmount, simulateTotals, toggleSelection, type SimulationTotals } from "@/lib/revenue/simulation";

const TYPE_LABEL: Record<RecommendationView["type"], string> = {
  cross_sell: "Cross-sell",
  upgrade: "Upgrade",
  extension: "Extension",
};

const CONFIDENCE_LEVEL: Record<RecommendationView["confidence"], number> = { low: 1, medium: 2, high: 3 };

const FIT_LABEL: Record<RecommendationView["confidence"], string> = {
  low: "Possible fit",
  medium: "Good fit",
  high: "Strong fit",
};

function shortTitle(r: RecommendationView): string {
  return r.type === "cross_sell" ? `Add ${r.productTitle}` : r.type === "upgrade" ? `Upgrade to ${r.productTitle}` : `Extend ${r.productTitle}`;
}

type PanelProps = {
  proposalUuid: string;
  currency: string | null;
  vatIncluded: boolean;
};

export function RecommendationsPanel({ proposalUuid, currency, vatIncluded }: PanelProps) {
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
  currency,
  vatIncluded,
}: { recommendations: RecommendationView[] } & Omit<PanelProps, "proposalUuid">) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(recommendations.map((r) => [r.id, { selected: false, quantity: r.quantity }])),
  );
  const update = (id: string, change: Partial<Choice>) =>
    setChoices((current) => ({ ...current, [id]: { ...current[id], ...change } }));
  const toggle = (r: RecommendationView) => setChoices((current) => toggleSelection(current, r.id, r.conflictsWith));

  const notes: string[] = [];
  recommendations.forEach((r, index) => {
    for (const other of recommendations.slice(index + 1)) {
      if (r.conflictsWith.includes(other.id)) {
        notes.push(`${shortTitle(r)} and ${shortTitle(other)} are alternatives: only one can be included.`);
      }
    }
  });
  for (const r of recommendations) {
    if (r.type !== "extension" || !choices[r.id].selected) continue;
    const upgrade = recommendations.find((o) => o.type === "upgrade" && o.lineItemId === r.lineItemId && choices[o.id].selected);
    if (upgrade) notes.push(`${shortTitle(r)} is priced at the ${r.productTitle} rate, not the upgraded ${upgrade.productTitle}.`);
  }

  const lines = recommendations.map((r) => {
    const { quantity, selected } = choices[r.id];
    return {
      id: r.id,
      label: shortTitle(r),
      vatRate: r.uplift?.vatRate ?? null,
      selected,
      amount: r.uplift ? opportunityAmount(r.uplift, quantity) : null,
      exclVat: r.uplift ? opportunityAmount(r.uplift.exclVat, quantity) : null,
      inclVat: r.uplift ? opportunityAmount(r.uplift.inclVat, quantity) : null,
    };
  });
  const totals = simulateTotals(lines);
  const selectedLines = lines.filter((line) => line.selected && line.amount !== null);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <ul className="space-y-3">
        {recommendations.map((recommendation) => (
          <li key={recommendation.id}>
            <RecommendationCard
              recommendation={recommendation}
              choice={choices[recommendation.id]}
              onToggle={() => toggle(recommendation)}
              onChange={(change) => update(recommendation.id, change)}
            />
          </li>
        ))}
      </ul>
      <div className="space-y-3 lg:sticky lg:top-24">
        {notes.length > 0 && (
          <Alert
            tone="neutral"
            variant="soft"
            title={notes.length === 1 ? "Note" : "Notes"}
            icon={
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
                <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 7.25v3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="5.1" r="0.85" fill="currentColor" />
              </svg>
            }
          >
            <ul className="space-y-1">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Alert>
        )}
        {currency && <SimulationSummary totals={totals} lines={selectedLines} currency={currency} vatIncluded={vatIncluded} />}
      </div>
    </div>
  );
}

function SimulationSummary({
  totals,
  lines,
  currency,
  vatIncluded,
}: {
  totals: SimulationTotals;
  lines: { id: string; label: string; vatRate: number | null; amount: number | null }[];
  currency: string;
  vatIncluded: boolean;
}) {
  const money = (minor: number | null) => formatMoney(minor, currency);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Potential revenue</h3>
        <span className="text-xs text-muted">Items {vatIncluded ? "incl." : "excl."} VAT</span>
      </div>
      {totals.selectedCount === 0 ? (
        <p className="mt-2 text-sm text-muted">Include opportunities to see what they could add.</p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          {lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-4">
              <dt>
                {line.label}
                {line.vatRate !== null && <span className="block text-xs text-muted">{formatPercent(line.vatRate)} VAT</span>}
              </dt>
              <dd className="shrink-0 whitespace-nowrap tabular-nums">{money(line.amount)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-divider pt-3 text-muted">
            <dt>Subtotal (excl. VAT)</dt>
            <dd className="tabular-nums">{money(totals.exclVat)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-muted">
            <dt>VAT</dt>
            <dd className="tabular-nums">{money(totals.vat)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-2 text-base font-semibold text-heading">
            <dt>Total (incl. VAT)</dt>
            <dd className="ml-auto tabular-nums">{money(totals.inclVat)}</dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

/** "20 rooms × 1 night × €145.00" with the AI's verified breakdown, else "21 × €145.00 / night". */
function formatCalculation(
  uplift: NonNullable<RecommendationView["uplift"]>,
  quantity: number,
  unit: string | null,
  breakdown: string | null,
): string {
  const money = (minor: number) => formatMoney(minor, uplift.currency);
  const price =
    uplift.replacedUnitPrice === null
      ? money(uplift.unitPrice)
      : `(${money(uplift.unitPrice)} − ${money(uplift.replacedUnitPrice)})`;
  return breakdown ? `${breakdown} × ${price}` : `${quantity} × ${price}${unit ? ` / ${unit}` : ""}`;
}

function RecommendationCard({
  recommendation: r,
  choice,
  onToggle,
  onChange,
}: {
  recommendation: RecommendationView;
  choice: Choice;
  onToggle: () => void;
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
        : `Extend ${r.productTitle}`;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="strong">{TYPE_LABEL[r.type]}</Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted" title="How well this fits the event, as judged by the AI. Not a likelihood of purchase.">
            <LevelBars level={CONFIDENCE_LEVEL[r.confidence]} />
            {FIT_LABEL[r.confidence]}
          </span>
        </div>
        <Button
          size="sm"
          variant={selected ? "primary" : "soft"}
          aria-pressed={selected}
          disabled={!r.uplift}
          onClick={onToggle}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="-ml-1 size-4">
            <path
              d={selected ? "M3.5 8.5l3 3 6-7" : "M8 3.5v9M3.5 8h9"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {selected ? "Included" : "Include"}
        </Button>
      </div>
      <p className="mt-3 font-medium text-heading">{title}</p>
      <p className="mt-1 text-sm">{r.explanation}</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {r.uplift ? (
          <div>
            <p className="text-sm text-body tabular-nums">{formatCalculation(r.uplift, quantity, r.unit, edited ? null : r.quantityLabel)}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-4xl font-medium tracking-[-0.02em] text-heading tabular-nums">
                {formatMoney(opportunityAmount(r.uplift, quantity), r.uplift.currency)}
              </span>
              <span className="text-sm text-muted">
                {r.uplift.vatIncluded ? "incl." : "excl."} VAT
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
          {edited && (
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
          )}
        </div>
      </div>
    </Card>
  );
}
