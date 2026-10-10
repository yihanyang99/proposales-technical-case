import { describe, expect, it } from "vitest";
import { opportunityAmount, simulateTotals, toggleSelection } from "./simulation";

describe("opportunityAmount", () => {
  it("multiplies the unit price by the quantity", () => {
    expect(opportunityAmount({ unitPrice: 900, replacedUnitPrice: null }, 60)).toBe(54000);
  });

  it("uses the price difference for upgrades", () => {
    expect(opportunityAmount({ unitPrice: 18500, replacedUnitPrice: 14500 }, 25)).toBe(100000);
  });
});

describe("simulateTotals", () => {
  it("adds only selected opportunities to the current total", () => {
    const totals = simulateTotals(1242000, [
      { selected: true, amount: 72000 },
      { selected: false, amount: 160000 },
      { selected: true, amount: 75000 },
    ]);
    expect(totals).toEqual({ current: 1242000, added: 147000, selectedCount: 2, potential: 1389000 });
  });

  it("ignores selected opportunities without a value", () => {
    const totals = simulateTotals(1000, [{ selected: true, amount: null }]);
    expect(totals).toEqual({ current: 1000, added: 0, selectedCount: 0, potential: 1000 });
  });

  it("has no potential total when the current total is unknown", () => {
    expect(simulateTotals(null, [{ selected: true, amount: 500 }]).potential).toBeNull();
  });

  it("returns the current total when nothing is selected", () => {
    expect(simulateTotals(5000, [])).toEqual({ current: 5000, added: 0, selectedCount: 0, potential: 5000 });
  });
});

describe("toggleSelection", () => {
  const choices = { a: { selected: false, quantity: 1 }, b: { selected: true, quantity: 2 }, c: { selected: true, quantity: 3 } };

  it("removes alternatives when including an opportunity", () => {
    expect(toggleSelection(choices, "a", ["b"])).toEqual({
      a: { selected: true, quantity: 1 },
      b: { selected: false, quantity: 2 },
      c: { selected: true, quantity: 3 },
    });
  });

  it("leaves other opportunities alone when removing one", () => {
    expect(toggleSelection(choices, "b", ["c"])).toEqual({ ...choices, b: { selected: false, quantity: 2 } });
  });
});
