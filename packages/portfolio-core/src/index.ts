import DecimalJs from "decimal.js";
import type { ExactDecimalValue } from "@folioagent/shared";

const Decimal = DecimalJs.clone({
  precision: 50,
  rounding: DecimalJs.ROUND_HALF_EVEN,
});

type CoreDecimal = InstanceType<typeof Decimal>;

export interface Holding {
  readonly ticker: string;
  readonly shares: ExactDecimalValue;
  readonly avgCost: ExactDecimalValue;
  readonly sector?: string | null;
  readonly tags?: readonly string[];
}

export type PriceMap = Readonly<Record<string, ExactDecimalValue | null | undefined>>;

export interface MetricChange {
  readonly amount: CoreDecimal;
  /** A fraction: 0.25 means 25%. Null when its denominator is zero. */
  readonly percent: CoreDecimal | null;
}

export interface PositionAllocation {
  readonly ticker: string;
  readonly value: CoreDecimal;
  /** A fraction: 0.25 means 25%. Null when total portfolio value is zero. */
  readonly percent: CoreDecimal | null;
}

export interface SectorAllocation {
  /** Null identifies holdings with no known sector. */
  readonly sector: string | null;
  readonly value: CoreDecimal;
  /** A fraction: 0.25 means 25%. Null when total portfolio value is zero. */
  readonly percent: CoreDecimal | null;
}

export type ScenarioTarget =
  | { readonly type: "ticker"; readonly value: string }
  | { readonly type: "tag"; readonly value: string };

export interface ScenarioChange {
  readonly target: ScenarioTarget;
  /** A fractional change: -1 means -100%, 0.1 means +10%. */
  readonly changePercent: ExactDecimalValue;
}

export interface ScenarioResult {
  readonly currentValue: CoreDecimal;
  readonly scenarioValue: CoreDecimal;
  readonly absoluteChange: CoreDecimal;
  /** A fraction: 0.25 means 25%. Null when current value is zero. */
  readonly percentChange: CoreDecimal | null;
  readonly allocationByPosition: readonly PositionAllocation[];
  readonly allocationBySector: readonly SectorAllocation[];
}

interface ValuedPosition {
  readonly holding: Holding;
  readonly shares: CoreDecimal;
  readonly avgCost: CoreDecimal;
  readonly price: CoreDecimal;
  readonly value: CoreDecimal;
  readonly costBasis: CoreDecimal;
}

function toDecimal(value: ExactDecimalValue, label: string): CoreDecimal {
  let decimal: CoreDecimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new RangeError(`${label} must be a finite decimal`);
  }
  if (!decimal.isFinite()) {
    throw new RangeError(`${label} must be a finite decimal`);
  }
  return decimal;
}

function valuePositions(holdings: readonly Holding[], prices: PriceMap): ValuedPosition[] {
  const seenTickers = new Set<string>();
  return holdings.map((holding) => {
    if (seenTickers.has(holding.ticker)) {
      throw new RangeError(`Duplicate ticker in holdings: ${holding.ticker}`);
    }
    seenTickers.add(holding.ticker);

    const shares = toDecimal(holding.shares, `shares for ${holding.ticker}`);
    if (shares.lte(0)) {
      throw new RangeError(`shares for ${holding.ticker} must be greater than zero`);
    }

    const avgCost = toDecimal(holding.avgCost, `avgCost for ${holding.ticker}`);
    if (avgCost.isNegative()) {
      throw new RangeError(`avgCost for ${holding.ticker} must be non-negative`);
    }

    const rawPrice = prices[holding.ticker];
    if (!Object.hasOwn(prices, holding.ticker) || rawPrice === null || rawPrice === undefined) {
      throw new RangeError(`Missing price for ticker ${holding.ticker}`);
    }
    const price = toDecimal(rawPrice, `price for ${holding.ticker}`);
    if (price.isNegative()) {
      throw new RangeError(`price for ${holding.ticker} must be non-negative`);
    }

    return {
      holding,
      shares,
      avgCost,
      price,
      value: shares.times(price),
      costBasis: shares.times(avgCost),
    };
  });
}

function sum(values: readonly CoreDecimal[]): CoreDecimal {
  return values.reduce((total, value) => total.plus(value), new Decimal(0));
}

function compareExact(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function positionAllocations(
  values: readonly { readonly ticker: string; readonly value: CoreDecimal }[],
): PositionAllocation[] {
  const total = sum(values.map((item) => item.value));
  return values.map(({ ticker, value }) => ({
    ticker,
    value,
    percent: total.isZero() ? null : value.div(total),
  }));
}

function sectorAllocations(
  values: readonly { readonly sector: string | null; readonly value: CoreDecimal }[],
): SectorAllocation[] {
  const totals = new Map<string | null, CoreDecimal>();
  for (const { sector, value } of values) {
    totals.set(sector, (totals.get(sector) ?? new Decimal(0)).plus(value));
  }
  const total = sum([...totals.values()]);
  return [...totals.entries()]
    .sort(([left], [right]) => {
      if (left === right) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return compareExact(left, right);
    })
    .map(([sector, value]) => ({
      sector,
      value,
      percent: total.isZero() ? null : value.div(total),
    }));
}

function tickerPositionAllocations(positions: readonly ValuedPosition[]): PositionAllocation[] {
  return positionAllocations(
    positions
      .map(({ holding, value }) => ({ ticker: holding.ticker, value }))
      .sort((left, right) => compareExact(left.ticker, right.ticker)),
  );
}

function holdingSectorAllocations(positions: readonly ValuedPosition[]): SectorAllocation[] {
  return sectorAllocations(
    positions.map(({ holding, value }) => ({ sector: holding.sector ?? null, value })),
  );
}

/** Returns the sum of shares multiplied by their current prices. */
export function portfolioValue(holdings: readonly Holding[], prices: PriceMap): CoreDecimal {
  return sum(valuePositions(holdings, prices).map(({ value }) => value));
}

/** Returns current minus previous portfolio value and the fraction of previous value. */
export function dayChange(
  holdings: readonly Holding[],
  currentPrices: PriceMap,
  previousPrices: PriceMap,
): MetricChange {
  const current = portfolioValue(holdings, currentPrices);
  const previous = portfolioValue(holdings, previousPrices);
  const amount = current.minus(previous);
  return {
    amount,
    percent: previous.isZero() ? null : amount.div(previous),
  };
}

/** Returns market value minus cost basis and the fraction of cost basis. */
export function gainLoss(holdings: readonly Holding[], prices: PriceMap): MetricChange {
  const positions = valuePositions(holdings, prices);
  const value = sum(positions.map(({ value }) => value));
  const costBasis = sum(positions.map(({ costBasis }) => costBasis));
  const amount = value.minus(costBasis);
  return {
    amount,
    percent: costBasis.isZero() ? null : amount.div(costBasis),
  };
}

/** Returns each position's market value and its fraction of the total. */
export function allocationByPosition(
  holdings: readonly Holding[],
  prices: PriceMap,
): PositionAllocation[] {
  return tickerPositionAllocations(valuePositions(holdings, prices));
}

/** Returns sector values; holdings without a sector are included under null. */
export function allocationBySector(
  holdings: readonly Holding[],
  prices: PriceMap,
): SectorAllocation[] {
  return holdingSectorAllocations(valuePositions(holdings, prices));
}

/** Returns the highest-value position, breaking ties by exact ticker order. */
export function largestPosition(
  holdings: readonly Holding[],
  prices: PriceMap,
): PositionAllocation | null {
  const positions = allocationByPosition(holdings, prices);
  if (positions.length === 0) return null;
  return positions.reduce((largest, position) => {
    if (position.value.gt(largest.value)) return position;
    if (position.value.eq(largest.value) && compareExact(position.ticker, largest.ticker) < 0) {
      return position;
    }
    return largest;
  });
}

/** Returns the largest known-sector share of total portfolio value; unknown sectors are excluded. */
export function sectorConcentration(
  holdings: readonly Holding[],
  prices: PriceMap,
): SectorAllocation | null {
  const positions = valuePositions(holdings, prices);
  const totalValue = sum(positions.map(({ value }) => value));
  if (totalValue.isZero()) return null;

  const knownSectors = sectorAllocations(
    positions
      .filter(({ holding }) => holding.sector !== null && holding.sector !== undefined)
      .map(({ holding, value }) => ({ sector: holding.sector!, value })),
  );
  if (knownSectors.length === 0) return null;

  const largest = knownSectors.reduce((result, item) => {
    if (item.value.gt(result.value)) return item;
    if (item.value.eq(result.value) && compareExact(item.sector!, result.sector!) < 0) return item;
    return result;
  });
  return {
    ...largest,
    percent: largest.value.div(totalValue),
  };
}

/** Computes simple sequential returns, expressed as fractions. */
export function dailyReturns(values: readonly ExactDecimalValue[]): CoreDecimal[] {
  const decimals = values.map((value, index) => {
    const decimal = toDecimal(value, `value at index ${index}`);
    if (decimal.isNegative()) throw new RangeError(`value at index ${index} must be non-negative`);
    return decimal;
  });
  if (decimals.length < 2) return [];

  const returns: CoreDecimal[] = [];
  for (let index = 1; index < decimals.length; index += 1) {
    const previous = decimals[index - 1]!;
    const current = decimals[index]!;
    if (previous.isZero()) {
      throw new RangeError(`value at index ${index - 1} must be greater than zero for returns`);
    }
    returns.push(current.div(previous).minus(1));
  }
  return returns;
}

/** Returns sample standard deviation of daily returns multiplied by sqrt(252). */
export function annualizedVolatility(returns: readonly ExactDecimalValue[]): CoreDecimal | null {
  const decimals = returns.map((value, index) => toDecimal(value, `return at index ${index}`));
  if (decimals.length < 2) return null;

  const mean = sum(decimals).div(decimals.length);
  const squaredDifferences = decimals.map((value) => value.minus(mean).pow(2));
  const sampleVariance = sum(squaredDifferences).div(decimals.length - 1);
  return sampleVariance.sqrt().times(new Decimal(252).sqrt());
}

/** Returns the largest peak-to-trough loss as a positive fraction. */
export function maxDrawdown(values: readonly ExactDecimalValue[]): CoreDecimal | null {
  const decimals = values.map((value, index) => {
    const decimal = toDecimal(value, `value at index ${index}`);
    if (decimal.isNegative()) throw new RangeError(`value at index ${index} must be non-negative`);
    return decimal;
  });
  if (decimals.length < 2) return null;

  let peak = new Decimal(0);
  let drawdown = new Decimal(0);
  for (const value of decimals) {
    if (value.gt(peak)) {
      peak = value;
    } else if (peak.isPositive()) {
      const candidate = peak.minus(value).div(peak);
      if (candidate.gt(drawdown)) drawdown = candidate;
    }
  }
  return drawdown;
}

/** Applies each matching ticker or tag percentage change once, compounding overlaps. */
export function runScenario(
  holdings: readonly Holding[],
  prices: PriceMap,
  changes: readonly ScenarioChange[],
): ScenarioResult {
  const positions = valuePositions(holdings, prices);
  const preparedChanges = changes.map((change) => {
    const changePercent = toDecimal(change.changePercent, "scenario changePercent");
    if (changePercent.lt(-1)) {
      throw new RangeError("scenario changePercent cannot be less than -100%");
    }
    return { ...change, changePercent };
  });

  const currentValue = sum(positions.map(({ value }) => value));
  const scenarioPositions = positions.map((position) => {
    let value = position.value;
    for (const change of preparedChanges) {
      const matches =
        change.target.type === "ticker"
          ? position.holding.ticker === change.target.value
          : (position.holding.tags ?? []).includes(change.target.value);
      if (matches) value = value.times(new Decimal(1).plus(change.changePercent));
    }
    return { holding: position.holding, value };
  });

  const scenarioValue = sum(scenarioPositions.map(({ value }) => value));
  const absoluteChange = scenarioValue.minus(currentValue);
  const totalBySector = scenarioPositions.map(({ holding, value }) => ({
    sector: holding.sector ?? null,
    value,
  }));
  return {
    currentValue,
    scenarioValue,
    absoluteChange,
    percentChange: currentValue.isZero() ? null : absoluteChange.div(currentValue),
    allocationByPosition: positionAllocations(
      scenarioPositions
        .map(({ holding, value }) => ({ ticker: holding.ticker, value }))
        .sort((left, right) => compareExact(left.ticker, right.ticker)),
    ),
    allocationBySector: sectorAllocations(totalBySector),
  };
}
