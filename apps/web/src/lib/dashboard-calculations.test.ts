import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  createDashboardSnapshot,
  evaluateScenario,
  sortDashboardHoldings,
  type DashboardHolding,
  type DashboardPrice,
} from "./dashboard-calculations.js";

const holdings: DashboardHolding[] = [
  { ticker: "AAPL", shares: "2", avg_cost: "10", tags: ["ai"], sector: "Technology" },
  { ticker: "KO", shares: "1", avg_cost: "50", tags: ["income"], sector: "Consumer Staples" },
];

const prices: DashboardPrice[] = [
  {
    ticker: "AAPL",
    latestClose: "12",
    previousClose: "10",
    asOf: "2026-11-20",
    fetchedAt: "2026-11-20T22:00:00.000Z",
    stale: false,
    history: [
      { date: "2026-11-18", close: "8" },
      { date: "2026-11-19", close: "10" },
      { date: "2026-11-20", close: "12" },
    ],
  },
  {
    ticker: "KO",
    latestClose: "50",
    previousClose: "48",
    asOf: "2026-11-20",
    fetchedAt: "2026-11-20T22:00:00.000Z",
    stale: false,
    history: [
      { date: "2026-11-18", close: "50" },
      { date: "2026-11-19", close: "48" },
      { date: "2026-11-20", close: "50" },
    ],
  },
];

describe("dashboard calculations", () => {
  it("uses portfolio-core for summary, allocation, history, and risk metrics", () => {
    const snapshot = createDashboardSnapshot(holdings, prices);

    expect(snapshot.currentValue).toBe("74");
    expect(snapshot.dayChange?.amount).toBe("6");
    expect(
      new Decimal(snapshot.dayChange!.percent!).minus(new Decimal(6).div(68)).abs().lt("1e-18"),
    ).toBe(true);
    expect(snapshot.gainLoss.amount).toBe("4");
    expect(snapshot.allocationByPosition.map((item) => item.label)).toEqual(["AAPL", "KO"]);
    expect(snapshot.allocationBySector.map((item) => item.label)).toEqual([
      "Consumer Staples",
      "Technology",
    ]);
    expect(snapshot.history.map((point) => point.value)).toEqual(["66", "68", "74"]);
    expect(snapshot.largestPosition).toMatchObject({ label: "KO", value: "50" });
    expect(snapshot.sectorConcentration?.label).toBe("Consumer Staples");
    expect(snapshot.volatility).not.toBeNull();
    expect(snapshot.maxDrawdown).not.toBeNull();
    expect(snapshot.stale).toBe(false);
    expect(snapshot.lastUpdated).toBe("2026-11-20T22:00:00.000Z");
  });

  it("evaluates tag-based scenario changes and rejects losses below -100%", () => {
    const result = evaluateScenario(holdings, prices, [
      { id: "rule-1", targetType: "tag", targetValue: "ai", changePercent: "10" },
    ]);

    expect(result.error).toBeNull();
    expect(new Decimal(result.result!.scenarioValue).eq("76.4")).toBe(true);
    expect(new Decimal(result.result!.absoluteChange).eq("2.4")).toBe(true);

    expect(
      evaluateScenario(holdings, prices, [
        { id: "rule-2", targetType: "ticker", targetValue: "AAPL", changePercent: "-101" },
      ]).error,
    ).toMatch(/cannot lose more than 100%/i);
  });

  it("sorts numeric holdings by exact decimal values", () => {
    const snapshot = createDashboardSnapshot(holdings, prices);
    const sorted = sortDashboardHoldings(snapshot.holdings, {
      key: "marketValue",
      descending: true,
    });

    expect(sorted.map((item) => item.ticker)).toEqual(["KO", "AAPL"]);
  });

  it("propagates stale-price labels to the portfolio and affected holding", () => {
    const snapshot = createDashboardSnapshot(holdings, [
      { ...prices[0]!, stale: true },
      prices[1]!,
    ]);

    expect(snapshot.stale).toBe(true);
    expect(snapshot.holdings.find((holding) => holding.ticker === "AAPL")?.stale).toBe(true);
    expect(snapshot.holdings.find((holding) => holding.ticker === "KO")?.stale).toBe(false);
  });

  it("returns an empty state without requiring prices", () => {
    expect(createDashboardSnapshot([], [])).toMatchObject({
      currentValue: "0",
      holdings: [],
      history: [],
      dayChange: null,
      stale: false,
    });
  });
});
