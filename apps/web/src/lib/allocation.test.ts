import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateCostBasis,
  calculateTotalCostBasis,
  calculateAllocationPercent,
} from "./allocation";

describe("allocation calculations", () => {
  it("calculates cost basis for single holding (shares x avg_cost)", () => {
    const basis = calculateCostBasis("12.5", "188.25");
    expect(basis.toString()).toBe("2353.125");
  });

  it("handles zero or invalid inputs gracefully", () => {
    expect(calculateCostBasis("0", "100").toString()).toBe("0");
    expect(calculateCostBasis("", "100").toString()).toBe("0");
    expect(calculateCostBasis("invalid", "100").toString()).toBe("0");
  });

  it("calculates total cost basis across multiple holdings", () => {
    const holdings = [
      { shares: "10", avg_cost: "50" },
      { shares: "5", avg_cost: "100" },
    ];
    const total = calculateTotalCostBasis(holdings);
    expect(total.toString()).toBe("1000");
  });

  it("calculates allocation fraction (% of total per ticker)", () => {
    const total = new Decimal("1000");
    const basis = new Decimal("250");
    const fraction = calculateAllocationPercent(basis, total);
    expect(fraction.toString()).toBe("0.25");
  });

  it("returns 0 when total cost basis is 0", () => {
    const fraction = calculateAllocationPercent("100", "0");
    expect(fraction.toString()).toBe("0");
  });
});
