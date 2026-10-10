"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import {
  applyProposalUpdate,
  clearFeedback,
  findOpportunities,
  saveFeedback,
  type FeedbackResult,
  type RecommendationsState,
  type RecommendationView,
} from "@/app/proposals/[uuid]/actions";
import {
  Alert,
  Badge,
  Button,
  Card,
  ChoiceChip,
  ChoiceGroup,
  EmptyState,
  FieldLabel,
  Input,
  LevelBars,
  QuantityInput,
  SectionTitle,
  Spinner,
} from "@/components/ui";
import { formatMoney, formatPercent } from "@/lib/format";
import { proposalEditorUrl } from "@/lib/proposales/links";
import {
  acceptChoice,
  DISMISS_REASON_LABEL,
  DISMISS_REASONS,
  initialChoice,
  MAX_COMMENT_LENGTH,
  type Choice,
  type DismissReason,
} from "@/lib/feedback/model";
import { MIN_QUANTITY, opportunityAmount, simulateTotals, type SimulationTotals } from "@/lib/revenue/simulation";

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

function fullTitle(r: RecommendationView): string {
  return r.type === "cross_sell"
    ? `Add ${r.productTitle}`
    : r.type === "upgrade"
      ? `Upgrade ${r.lineItemTitle ?? "current item"} to ${r.productTitle}`
      : `Extend ${r.productTitle}`;
}

function shortTitle(r: RecommendationView): string {
  return r.type === "cross_sell" ? `Add ${r.productTitle}` : r.type === "upgrade" ? `Upgrade to ${r.productTitle}` : `Extend ${r.productTitle}`;
}

type PanelProps = {
  proposalUuid: string;
  /** Only drafts can be updated in Proposales. */
  isDraft: boolean;
  currency: string | null;
  vatIncluded: boolean;
};

export function RecommendationsPanel({ proposalUuid, isDraft, currency, vatIncluded }: PanelProps) {
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
      {!isDraft && (
        <p className="text-sm text-muted">
          This proposal isn&apos;t a draft, so suggestions are advice only. Create a new version in Proposales to add them.
        </p>
      )}

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
          proposalUuid={proposalUuid}
          isDraft={isDraft}
          recommendations={state.recommendations}
          decisions={state.decisions}
          currency={currency}
          vatIncluded={vatIncluded}
        />
      )}

      {!pending && state.status === "done" && (
        <p className="text-xs text-muted">
          Suggested by AI from this proposal and the hotel catalog. Values are potential revenue at list price. Review
          before adding. Your choices are saved and inform the next suggestions for this proposal.
        </p>
      )}
    </section>
  );
}

function OpportunityList({
  proposalUuid,
  isDraft,
  recommendations,
  decisions,
  currency,
  vatIncluded,
}: {
  recommendations: RecommendationView[];
  decisions: Extract<RecommendationsState, { status: "done" }>["decisions"];
} & PanelProps) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(recommendations.map((r) => [r.id, initialChoice(r.quantity, r.maxQuantity, decisions[r.id])])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Opportunities already written to the draft in this session. */
  const [applied, setApplied] = useState<Set<string>>(() => new Set());
  const queues = useRef<Record<string, Promise<void>>>({});

  const byId = new Map(recommendations.map((r) => [r.id, r]));

  const send = async (r: RecommendationView, choice: Choice) => {
    const key = { proposalUuid, recommendationId: r.id };
    let result: FeedbackResult;
    try {
      result =
        choice.status === "pending"
          ? await clearFeedback(key)
          : await saveFeedback({
              ...key,
              type: r.type,
              productId: r.productId,
              suggestedQuantity: r.quantity,
              confidence: r.confidence,
              decision:
                choice.status === "accepted"
                  ? { status: "accepted", quantity: choice.quantity }
                  : { status: "dismissed", reason: choice.reason, comment: choice.comment },
            });
    } catch {
      result = { ok: false, message: "Your choice could not be saved. Please try again." };
    }
    setErrors((current) => {
      const next = { ...current };
      if (result.ok) delete next[r.id];
      else next[r.id] = result.message;
      return next;
    });
  };

  /**
   * Saves (or, for pending, clears) one choice and shows an error on its card if that fails.
   * Saves for the same suggestion run one after another, so the last click always wins.
   */
  const persist = (r: RecommendationView, choice: Choice) => {
    queues.current[r.id] = (queues.current[r.id] ?? Promise.resolve()).then(() => send(r, choice));
    return queues.current[r.id];
  };

  const change = (r: RecommendationView, choice: Choice) => {
    setChoices((current) => ({ ...current, [r.id]: choice }));
    void persist(r, choice);
  };

  const accept = (r: RecommendationView) => {
    const { choices: next, reopened } = acceptChoice(choices, r.id, r.conflictsWith);
    setChoices(next);
    void persist(r, next[r.id]);
    for (const id of reopened) {
      const other = byId.get(id);
      if (other) void persist(other, next[id]);
    }
  };

  const reopen = (r: RecommendationView) => change(r, { status: "pending", quantity: choices[r.id].quantity, dismissing: false });

  const setDismissing = (r: RecommendationView, dismissing: boolean) =>
    setChoices((current) => ({ ...current, [r.id]: { status: "pending", quantity: current[r.id].quantity, dismissing } }));

  const setQuantity = (r: RecommendationView, quantity: number) => {
    const choice = { ...choices[r.id], quantity };
    if (choice.status === "accepted") change(r, choice);
    else setChoices((current) => ({ ...current, [r.id]: choice }));
  };

  const isAccepted = (id: string) => choices[id]?.status === "accepted";

  const notes: string[] = [];
  recommendations.forEach((r, index) => {
    for (const other of recommendations.slice(index + 1)) {
      if (r.conflictsWith.includes(other.id)) {
        notes.push(`${shortTitle(r)} and ${shortTitle(other)} are alternatives: only one can be added.`);
      }
    }
  });
  for (const r of recommendations) {
    if (r.type !== "extension" || !isAccepted(r.id)) continue;
    const upgrade = recommendations.find((o) => o.type === "upgrade" && o.lineItemId === r.lineItemId && isAccepted(o.id));
    if (upgrade) notes.push(`${shortTitle(r)} is priced at the ${r.productTitle} rate, not the upgraded ${upgrade.productTitle}.`);
  }

  const toUpdate = recommendations.filter((r) => isAccepted(r.id) && !applied.has(r.id));
  const lines = toUpdate.map((r) => {
    const { quantity } = choices[r.id];
    return {
      id: r.id,
      label: shortTitle(r),
      vatRate: r.uplift?.vatRate ?? null,
      selected: true,
      amount: r.uplift ? opportunityAmount(r.uplift, quantity) : null,
      exclVat: r.uplift ? opportunityAmount(r.uplift.exclVat, quantity) : null,
      inclVat: r.uplift ? opportunityAmount(r.uplift.inclVat, quantity) : null,
    };
  });
  const totals = simulateTotals(lines);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <ul className="space-y-3">
        {recommendations.map((r) => {
          const choice = choices[r.id];
          return (
            <li key={r.id}>
              {choice.status === "dismissed" ? (
                <DismissedCard
                  recommendation={r}
                  choice={choice}
                  error={errors[r.id]}
                  onUndo={() => reopen(r)}
                  onRetry={() => void persist(r, choice)}
                />
              ) : (
                <RecommendationCard
                  recommendation={r}
                  choice={choice}
                  inProposal={applied.has(r.id)}
                  error={errors[r.id]}
                  onAccept={() => accept(r)}
                  onUndo={() => reopen(r)}
                  onStartDismiss={() => setDismissing(r, true)}
                  onCancelDismiss={() => setDismissing(r, false)}
                  onDismiss={(reason, comment) => change(r, { status: "dismissed", quantity: choice.quantity, reason, comment })}
                  onQuantity={(quantity) => setQuantity(r, quantity)}
                  onRetry={() => void persist(r, choice)}
                />
              )}
            </li>
          );
        })}
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
        {currency && (
          <ProposalUpdate
            proposalUuid={proposalUuid}
            isDraft={isDraft}
            totals={totals}
            lines={lines.filter((line) => line.amount !== null)}
            items={toUpdate.map((r) => ({ type: r.type, productId: r.productId, lineItemId: r.lineItemId, quantity: choices[r.id].quantity }))}
            currency={currency}
            vatIncluded={vatIncluded}
            onApplied={() => setApplied((current) => new Set([...current, ...toUpdate.map((r) => r.id)]))}
          />
        )}
      </div>
    </div>
  );
}

type UpdateLine = { id: string; label: string; vatRate: number | null; amount: number | null };
type UpdateItem = { type: RecommendationView["type"]; productId: number; lineItemId: string | null; quantity: number };

/** What will go into the draft, with its potential revenue, and "Update draft in Proposales" after a confirmation. */
function ProposalUpdate({
  proposalUuid,
  isDraft,
  totals,
  lines,
  items,
  currency,
  vatIncluded,
  onApplied,
}: {
  proposalUuid: string;
  isDraft: boolean;
  totals: SimulationTotals;
  lines: UpdateLine[];
  items: UpdateItem[];
  currency: string;
  vatIncluded: boolean;
  onApplied: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const money = (minor: number | null) => formatMoney(minor, currency);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await applyProposalUpdate({ proposalUuid, items });
      setConfirming(false);
      if (result.ok) {
        setUpdated(true);
        onApplied();
        router.refresh();
      } else setError(result.message);
    } catch {
      setError("The update could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Potential revenue</h3>
        <span className="text-xs text-muted">Items {vatIncluded ? "incl." : "excl."} VAT</span>
      </div>
      {updated && (
        <p role="status" className="mt-2 text-sm text-body">
          Draft updated in Proposales.{" "}
          <a href={proposalEditorUrl(proposalUuid)} target="_blank" rel="noreferrer" className="font-medium text-heading underline underline-offset-2">
            Open proposal
          </a>
        </p>
      )}
      {items.length === 0 ? (
        !updated && <p className="mt-2 text-sm text-muted">Add opportunities to include them in this proposal.</p>
      ) : (
        <>
          <dl className="mt-3 space-y-2 text-sm">
            {lines.map((line) => (
              <div key={line.id} className="flex justify-between gap-4">
                <dt className="text-body">
                  {line.label}
                  <span className="mt-0.5 block text-xs text-muted">
                    Optional for the customer
                    {line.vatRate !== null && ` · ${formatPercent(line.vatRate)} VAT`}
                  </span>
                </dt>
                <dd className="shrink-0 whitespace-nowrap text-body tabular-nums">{money(line.amount)}</dd>
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

          {isDraft &&
            (confirming ? (
              <div className="mt-4 space-y-3 border-t border-divider pt-4 text-sm">
                <div>
                  <p className="font-medium text-heading">
                    Add {items.length} optional {items.length === 1 ? "extra" : "extras"} to the draft?
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Nothing is sent to the customer.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={confirm} disabled={busy}>
                    {busy && <Spinner />}
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" className="mt-4 w-full" onClick={() => setConfirming(true)}>
                Update draft in Proposales
              </Button>
            ))}
          {error && (
            <p role="alert" className="mt-3 text-xs text-failure">
              {error}
            </p>
          )}
        </>
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

function SaveError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p role="alert" className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-failure">
      {message}
      <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2 hover:text-heading">
        Retry
      </button>
    </p>
  );
}

function DismissedCard({
  recommendation: r,
  choice,
  error,
  onUndo,
  onRetry,
}: {
  recommendation: RecommendationView;
  choice: Extract<Choice, { status: "dismissed" }>;
  error: string | undefined;
  onUndo: () => void;
  onRetry: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-heading">{fullTitle(r)}</p>
          <p className="mt-0.5 text-xs text-muted">
            Not a fit: {DISMISS_REASON_LABEL[choice.reason]}
            {choice.comment && ` · ${choice.comment}`}
          </p>
        </div>
        <Button size="sm" variant="soft" onClick={onUndo}>
          Undo
        </Button>
      </div>
      {error && <SaveError message={error} onRetry={onRetry} />}
    </Card>
  );
}

function DismissForm({ id, onDismiss, onCancel }: { id: string; onDismiss: (reason: DismissReason, comment: string | null) => void; onCancel: () => void }) {
  const [reason, setReason] = useState<DismissReason | null>(null);
  // "Other" chosen for the salesperson because they typed their own reason; undone if they clear it.
  const [autoOther, setAutoOther] = useState(false);
  const [comment, setComment] = useState("");
  const updateComment = (value: string) => {
    setComment(value);
    if (value.trim() && !reason) {
      setReason("other");
      setAutoOther(true);
    } else if (!value.trim() && autoOther) {
      setReason(null);
      setAutoOther(false);
    }
  };
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason) onDismiss(reason, comment.trim() || null);
      }}
    >
      <ChoiceGroup legend="What makes it a poor fit? It helps the AI suggest better next time.">
        {DISMISS_REASONS.map((value) => (
          <ChoiceChip
            key={value}
            name={`reason-${id}`}
            value={value}
            checked={reason === value}
            onChange={() => {
              setReason(value);
              setAutoOther(false);
            }}
          >
            {DISMISS_REASON_LABEL[value]}
          </ChoiceChip>
        ))}
      </ChoiceGroup>
      <div>
        <FieldLabel htmlFor={`comment-${id}`}>Your own reason or a comment (optional)</FieldLabel>
        <Input
          id={`comment-${id}`}
          variant="soft"
          value={comment}
          maxLength={MAX_COMMENT_LENGTH}
          onChange={(event) => updateComment(event.target.value)}
          placeholder={reason && !autoOther ? "Add a comment (optional)" : "Or write your own reason"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!reason}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Keep suggestion
        </Button>
        {!reason && <p className="text-xs text-muted">Choose a reason or write your own.</p>}
      </div>
    </form>
  );
}

function RecommendationCard({
  recommendation: r,
  choice,
  inProposal,
  error,
  onAccept,
  onUndo,
  onStartDismiss,
  onCancelDismiss,
  onDismiss,
  onQuantity,
  onRetry,
}: {
  recommendation: RecommendationView;
  choice: Exclude<Choice, { status: "dismissed" }>;
  /** Already written to the draft in this session. */
  inProposal: boolean;
  error: string | undefined;
  onAccept: () => void;
  onUndo: () => void;
  onStartDismiss: () => void;
  onCancelDismiss: () => void;
  onDismiss: (reason: DismissReason, comment: string | null) => void;
  onQuantity: (quantity: number) => void;
  onRetry: () => void;
}) {
  const { quantity } = choice;
  const accepted = choice.status === "accepted";
  const dismissing = choice.status === "pending" && choice.dismissing;
  const suggestion = r.quantityLabel ?? `${r.quantity}${r.unit ? ` ${r.unit}` : ""}`;
  const edited = quantity !== r.quantity;
  // Top right from tablet up; at the bottom of the card, full width, on phones.
  const actions = (wide: boolean) => (
    <div className="flex items-center gap-2">
      {!accepted && (
        <Button size="sm" variant="ghost" onClick={onStartDismiss}>
          Not a fit
        </Button>
      )}
      <Button
        size="sm"
        variant={accepted ? "primary" : "soft"}
        className={wide ? "flex-1" : undefined}
        aria-pressed={accepted}
        aria-label={accepted ? "Added, select to remove" : undefined}
        onClick={accepted ? onUndo : onAccept}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="-ml-1 size-4">
          <path
            d={accepted ? "M3.5 8.5l3 3 6-7" : "M8 3.5v9M3.5 8h9"}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {accepted ? "Added" : "Add to proposal"}
      </Button>
    </div>
  );

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
        {inProposal ? <Badge tone="success">In proposal</Badge> : !dismissing && <div className="hidden sm:block">{actions(false)}</div>}
      </div>
      <p className="mt-3 font-medium text-heading">{fullTitle(r)}</p>
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
              onChange={onQuantity}
              label={`quantity for ${r.productTitle}`}
              disabled={inProposal}
            />
          </div>
          {edited && !inProposal && (
            <button
              type="button"
              onClick={() => onQuantity(r.quantity)}
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
      {!inProposal && !dismissing && <div className="mt-5 sm:hidden">{actions(true)}</div>}
      {dismissing && <DismissForm id={r.id} onDismiss={onDismiss} onCancel={onCancelDismiss} />}
      {error && <SaveError message={error} onRetry={onRetry} />}
    </Card>
  );
}
