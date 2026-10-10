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
  it("sums only selected opportunities on both VAT bases and breaks out the VAT", () => {
    expect(
      simulateTotals([
        { selected: true, exclVat: 72000, inclVat: 80640 },
        { selected: false, exclVat: 160000, inclVat: 179200 },
        { selected: true, exclVat: 290000, inclVat: 324800 },
      ]),
    ).toEqual({ selectedCount: 2, exclVat: 362000, vat: 43440, inclVat: 405440 });
  });

  it("ignores selected opportunities without a value", () => {
    expect(simulateTotals([{ selected: true, exclVat: null, inclVat: null }])).toEqual({
      selectedCount: 0,
      exclVat: 0,
      vat: 0,
      inclVat: 0,
    });
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

