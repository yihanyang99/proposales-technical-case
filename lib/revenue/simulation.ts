// Pure revenue simulation for selected opportunities. Safe for client and server: no I/O.

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10_000;

export type PricedOpportunity = {
  /** Unit price on the proposal's VAT basis, minor units (for an upgrade: the replacement's price). */
  unitPrice: number;
  /** Upgrade only: the current line item's unit price that is replaced, same basis. */
  replacedUnitPrice: number | null;
};

/** Additional revenue for a quantity: (unit price − replaced unit price) × quantity. */
export function opportunityAmount(opportunity: PricedOpportunity, quantity: number): number {
  return (opportunity.unitPrice - (opportunity.replacedUnitPrice ?? 0)) * quantity;
}

export type SimulationLine = { selected: boolean; amount: number | null };

export type SimulationTotals = {
  /** Proposal total before any opportunity, or null if unknown. */
  current: number | null;
  /** Sum of selected opportunities that have a value. */
  added: number;
  selectedCount: number;
  /** current + added, or null when the current total is unknown. */
  potential: number | null;
};

/** Running totals for the selection. Opportunities without a value are never counted. */
export function simulateTotals(currentTotal: number | null, lines: SimulationLine[]): SimulationTotals {
  const counted = lines.filter((line): line is { selected: true; amount: number } => line.selected && line.amount !== null);
  const added = counted.reduce((sum, line) => sum + line.amount, 0);
  return {
    current: currentTotal,
    added,
    selectedCount: counted.length,
    potential: currentTotal === null ? null : currentTotal + added,
  };
}

/** Includes or removes one opportunity; including it removes its alternatives. */
export function toggleSelection<T extends { selected: boolean }>(
  choices: Record<string, T>,
  id: string,
  conflictsWith: string[],
): Record<string, T> {
  const selected = !choices[id].selected;
  const next = { ...choices, [id]: { ...choices[id], selected } };
  if (selected) {
    for (const other of conflictsWith) {
      if (next[other]) next[other] = { ...next[other], selected: false };
    }
  }
  return next;
}
