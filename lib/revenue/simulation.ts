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

export type SimulationLine = { selected: boolean; exclVat: number | null; inclVat: number | null };

export type SimulationTotals = { selectedCount: number; exclVat: number; vat: number; inclVat: number };

/** Totals of the selected opportunities on both VAT bases. Opportunities without a value are never counted. */
export function simulateTotals(lines: SimulationLine[]): SimulationTotals {
  const counted = lines.filter(
    (line): line is { selected: true; exclVat: number; inclVat: number } =>
      line.selected && line.exclVat !== null && line.inclVat !== null,
  );
  const exclVat = counted.reduce((sum, line) => sum + line.exclVat, 0);
  const inclVat = counted.reduce((sum, line) => sum + line.inclVat, 0);
  return { selectedCount: counted.length, exclVat, vat: inclVat - exclVat, inclVat };
}
