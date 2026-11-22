import Decimal from "decimal.js";
import {
  allocationByPosition,
  allocationBySector,
  annualizedVolatility,
  dailyReturns,
  dayChange,
  gainLoss,
  largestPosition,
  maxDrawdown,
  portfolioValue,
  runScenario,
  sectorConcentration,
  type Holding as PortfolioHolding,
  type ScenarioChange,
} from "@folioagent/portfolio-core";

export interface DashboardHolding {
  ticker: string;
  shares: string;
  avg_cost: string;
  tags: string[];
  name?: string | null;
  sector?: string | null;
}

export interface DashboardPrice {
  ticker: string;
  latestClose: string;
  previousClose: string | null;
  asOf: string;
  fetchedAt: string;
  stale: boolean;
  history: Array<{ date: string; close: string }>;
}

export interface MetricView {
  amount: string;
  percent: string | null;
  direction: "positive" | "negative" | "neutral";
}

export interface AllocationView {
  label: string;
  value: string;
  chartValue: number;
  percent: string | null;
}

export interface DashboardHistoryPoint {
  date: string;
  value: string;
  chartValue: number;
}

export interface DashboardHoldingView {
  ticker: string;
  name: string;
  sector: string | null;
  shares: string;
  currentPrice: string;
  marketValue: string;
  dayChange: MetricView | null;
  stale: boolean;
  asOf: string;
  sparklinePoints: string;
}

export interface DashboardSnapshot {
  currentValue: string;
  dayChange: MetricView | null;
  gainLoss: MetricView;
  allocationByPosition: AllocationView[];
  allocationBySector: AllocationView[];
  history: DashboardHistoryPoint[];
  holdings: DashboardHoldingView[];
  largestPosition: AllocationView | null;
  sectorConcentration: AllocationView | null;
  volatility: string | null;
  maxDrawdown: string | null;
  stale: boolean;
  lastUpdated: string | null;
}

export type DashboardSortKey = "ticker" | "shares" | "currentPrice" | "marketValue" | "dayChange";

export interface ScenarioRuleInput {
  id: string;
  targetType: "ticker" | "tag";
  targetValue: string;
  changePercent: string;
}

export interface ScenarioEvaluation {
  result: ScenarioResultView | null;
  error: string | null;
}

export interface ScenarioResultView {
  currentValue: string;
  scenarioValue: string;
  absoluteChange: string;
  percentChange: string | null;
  direction: MetricView["direction"];
  allocationByPosition: AllocationView[];
}

const emptySnapshot: DashboardSnapshot = {
  currentValue: "0",
  dayChange: null,
  gainLoss: { amount: "0", percent: null, direction: "neutral" },
  allocationByPosition: [],
  allocationBySector: [],
  history: [],
  holdings: [],
  largestPosition: null,
  sectorConcentration: null,
  volatility: null,
  maxDrawdown: null,
  stale: false,
  lastUpdated: null,
};

function toPortfolioHoldings(holdings: readonly DashboardHolding[]): PortfolioHolding[] {
  return holdings.map((holding) => ({
    ticker: holding.ticker,
    shares: holding.shares,
    avgCost: holding.avg_cost,
    sector: holding.sector ?? null,
    tags: holding.tags,
  }));
}

function directionOf(value: Decimal): MetricView["direction"] {
  if (value.isPositive()) return "positive";
  if (value.isNegative()) return "negative";
  return "neutral";
}

function metricView(value: { amount: Decimal; percent: Decimal | null }): MetricView {
  return {
    amount: value.amount.toString(),
    percent: value.percent?.toString() ?? null,
    direction: directionOf(value.amount),
  };
}

function allocationView(
  value: {
    ticker?: string;
    sector?: string | null;
    value: Decimal;
    percent: Decimal | null;
  } | null,
): AllocationView | null {
  if (!value) return null;
  const label = value.ticker ?? value.sector ?? "Unknown sector";
  return {
    label,
    value: value.value.toString(),
    chartValue: value.value.toNumber(),
    percent: value.percent?.toString() ?? null,
  };
}

function historyByTicker(prices: readonly DashboardPrice[]): Map<string, Map<string, string>> {
  return new Map(
    prices.map((price) => [
      price.ticker,
      new Map(price.history.map((point) => [point.date, point.close])),
    ]),
  );
}

function completeDates(
  holdings: readonly PortfolioHolding[],
  history: ReadonlyMap<string, ReadonlyMap<string, string>>,
): string[] {
  const [firstHolding] = holdings;
  if (!firstHolding) return [];
  const firstDates = history.get(firstHolding.ticker);
  if (!firstDates) return [];
  return [...firstDates.keys()]
    .filter((date) => holdings.every((holding) => history.get(holding.ticker)?.has(date)))
    .sort((left, right) => left.localeCompare(right));
}

function sparklinePoints(values: readonly string[]): string {
  if (values.length < 2) return "0,12 80,12";
  const numbers = values.map(Number);
  const minimum = Math.min(...numbers);
  const maximum = Math.max(...numbers);
  const range = maximum - minimum;
  return numbers
    .map((value, index) => {
      const x = (index / (numbers.length - 1)) * 80;
      const y = range === 0 ? 12 : 22 - ((value - minimum) / range) * 20;
      return `${x},${y}`;
    })
    .join(" ");
}

export function createDashboardSnapshot(
  holdings: readonly DashboardHolding[],
  prices: readonly DashboardPrice[],
): DashboardSnapshot {
  if (holdings.length === 0) return emptySnapshot;

  const portfolioHoldings = toPortfolioHoldings(holdings);
  const priceByTicker = new Map(prices.map((price) => [price.ticker, price]));
  const currentPrices = Object.fromEntries(
    prices.map((price) => [price.ticker, price.latestClose]),
  );
  const currentValue = portfolioValue(portfolioHoldings, currentPrices);
  const gainLossMetric = gainLoss(portfolioHoldings, currentPrices);
  const positions = allocationByPosition(portfolioHoldings, currentPrices);
  const sectors = allocationBySector(portfolioHoldings, currentPrices);
  const historyLookup = historyByTicker(prices);
  const dates = completeDates(portfolioHoldings, historyLookup);
  const history = dates.map((date) => {
    const datePrices = Object.fromEntries(
      portfolioHoldings.map((holding) => [
        holding.ticker,
        historyLookup.get(holding.ticker)?.get(date),
      ]),
    );
    const value = portfolioValue(portfolioHoldings, datePrices);
    return { date, value: value.toString(), chartValue: value.toNumber() };
  });
  const previousPrices = Object.fromEntries(
    prices
      .filter((price) => price.previousClose !== null)
      .map((price) => [price.ticker, price.previousClose]),
  );
  const dayChangeMetric = portfolioHoldings.every(
    (holding) => priceByTicker.get(holding.ticker)?.previousClose !== null,
  )
    ? metricView(dayChange(portfolioHoldings, currentPrices, previousPrices))
    : null;
  const historyHasZeroPrior =
    history.length < 2 || history.slice(0, -1).some((point) => new Decimal(point.value).isZero());
  const volatility = historyHasZeroPrior
    ? null
    : (annualizedVolatility(dailyReturns(history.map((point) => point.value)))?.toString() ?? null);
  const latestPositionByTicker = new Map(positions.map((position) => [position.ticker, position]));
  const holdingViews = holdings.map((holding) => {
    const price = priceByTicker.get(holding.ticker);
    if (!price) throw new RangeError(`Missing price data for ${holding.ticker}`);
    const coreHolding = portfolioHoldings.find((item) => item.ticker === holding.ticker);
    if (!coreHolding) throw new RangeError(`Missing portfolio holding ${holding.ticker}`);
    const rowHistory = price.history.map((point) =>
      portfolioValue([coreHolding], { [holding.ticker]: point.close }).toString(),
    );
    const previousClose = price.previousClose;
    const rowDayChange =
      previousClose === null
        ? null
        : metricView(
            dayChange(
              [coreHolding],
              { [holding.ticker]: price.latestClose },
              { [holding.ticker]: previousClose },
            ),
          );
    return {
      ticker: holding.ticker,
      name: holding.name?.trim() || holding.ticker,
      sector: holding.sector ?? null,
      shares: holding.shares,
      currentPrice: price.latestClose,
      marketValue: latestPositionByTicker.get(holding.ticker)?.value.toString() ?? "0",
      dayChange: rowDayChange,
      stale: price.stale,
      asOf: price.asOf,
      sparklinePoints: sparklinePoints(rowHistory),
    };
  });
  const lastUpdated =
    prices.map((price) => price.fetchedAt).sort((left, right) => right.localeCompare(left))[0] ??
    null;
  const largest = largestPosition(portfolioHoldings, currentPrices);
  const concentration = sectorConcentration(portfolioHoldings, currentPrices);
  const drawdown = maxDrawdown(history.map((point) => point.value));

  return {
    currentValue: currentValue.toString(),
    dayChange: dayChangeMetric,
    gainLoss: metricView(gainLossMetric),
    allocationByPosition: positions.map((position) => ({
      label: position.ticker,
      value: position.value.toString(),
      chartValue: position.value.toNumber(),
      percent: position.percent?.toString() ?? null,
    })),
    allocationBySector: sectors.map((sector) => allocationView(sector)!),
    history,
    holdings: holdingViews,
    largestPosition: allocationView(largest),
    sectorConcentration: allocationView(concentration),
    volatility,
    maxDrawdown: drawdown?.toString() ?? null,
    stale: prices.some((price) => price.stale),
    lastUpdated,
  };
}

export function sortDashboardHoldings(
  holdings: readonly DashboardHoldingView[],
  sort: { key: DashboardSortKey; descending: boolean },
): DashboardHoldingView[] {
  return [...holdings].sort((left, right) => {
    let order: number;
    if (sort.key === "ticker") {
      order = left.ticker.localeCompare(right.ticker);
    } else {
      const leftValue = sort.key === "dayChange" ? left.dayChange?.amount : left[sort.key];
      const rightValue = sort.key === "dayChange" ? right.dayChange?.amount : right[sort.key];
      if (leftValue === undefined || rightValue === undefined || leftValue === null) {
        order =
          leftValue === rightValue ? 0 : leftValue === null || leftValue === undefined ? 1 : -1;
      } else {
        order = new Decimal(leftValue).comparedTo(new Decimal(rightValue));
      }
    }
    if (order === 0) order = left.ticker.localeCompare(right.ticker);
    return sort.descending ? -order : order;
  });
}

export function evaluateScenario(
  holdings: readonly DashboardHolding[],
  prices: readonly DashboardPrice[],
  rules: readonly ScenarioRuleInput[],
): ScenarioEvaluation {
  const activeRules = rules.filter((rule) => rule.changePercent.trim() !== "");
  if (activeRules.length === 0) return { result: null, error: null };

  const changes: ScenarioChange[] = [];
  for (const rule of activeRules) {
    const percentage = rule.changePercent.trim();
    const targetValue = rule.targetValue.trim();
    if (!percentage || !targetValue) {
      return { result: null, error: "Complete each adjustment or remove it." };
    }
    let changePercent: Decimal;
    try {
      changePercent = new Decimal(percentage);
    } catch {
      return { result: null, error: "Enter a valid percentage for each adjustment." };
    }
    if (!changePercent.isFinite()) {
      return { result: null, error: "Enter a valid percentage for each adjustment." };
    }
    if (changePercent.lt(-100)) {
      return { result: null, error: "A holding cannot lose more than 100% in a scenario." };
    }
    changes.push({
      target: { type: rule.targetType, value: targetValue },
      changePercent: changePercent.div(100).toString(),
    });
  }

  const portfolioHoldings = toPortfolioHoldings(holdings);
  const latestPrices = Object.fromEntries(prices.map((price) => [price.ticker, price.latestClose]));
  const result = runScenario(portfolioHoldings, latestPrices, changes);
  return {
    result: {
      currentValue: result.currentValue.toString(),
      scenarioValue: result.scenarioValue.toString(),
      absoluteChange: result.absoluteChange.toString(),
      percentChange: result.percentChange?.toString() ?? null,
      direction: directionOf(result.absoluteChange),
      allocationByPosition: result.allocationByPosition.map((position) => ({
        label: position.ticker,
        value: position.value.toString(),
        chartValue: position.value.toNumber(),
        percent: position.percent?.toString() ?? null,
      })),
    },
    error: null,
  };
}
