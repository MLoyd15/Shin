import Decimal from "decimal.js";

export interface HoldingInput {
  shares: string | number;
  avg_cost: string | number;
}

export function calculateCostBasis(shares: string | number, avgCost: string | number): Decimal {
  try {
    const s = new Decimal(shares || 0);
    const c = new Decimal(avgCost || 0);
    return s.times(c);
  } catch {
    return new Decimal(0);
  }
}

export function calculateTotalCostBasis(holdings: HoldingInput[]): Decimal {
  return holdings.reduce((sum, item) => {
    return sum.plus(calculateCostBasis(item.shares, item.avg_cost));
  }, new Decimal(0));
}

export function calculateAllocationPercent(
  costBasis: Decimal | string | number,
  totalCostBasis: Decimal | string | number,
): Decimal {
  try {
    const cost = new Decimal(costBasis || 0);
    const total = new Decimal(totalCostBasis || 0);
    if (total.isZero() || cost.isZero()) return new Decimal(0);
    return cost.dividedBy(total);
  } catch {
    return new Decimal(0);
  }
}
