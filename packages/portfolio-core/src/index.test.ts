import Decimal from "decimal.js";
import fc from "fast-check";
import { formatPercent } from "@folioagent/shared";
import { describe, expect, it } from "vitest";
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
  type Holding,
  type PriceMap,
} from "./index.js";

const holdings: Holding[] = [
  { ticker: "AAA", shares: "2", avgCost: "100", sector: "Technology", tags: ["growth"] },
  { ticker: "BBB", shares: "1", avgCost: "200", sector: "Technology", tags: ["growth"] },
  { ticker: "CCC", shares: "3", avgCost: "50", sector: "Consumer", tags: ["income"] },
  { ticker: "DDD", shares: "2", avgCost: "80", sector: "Energy", tags: ["income"] },
  { ticker: "EEE", shares: "1", avgCost: "50", sector: null, tags: ["growth"] },
];

const currentPrices: PriceMap = {
  AAA: "120",
  BBB: "180",
  CCC: "60",
  DDD: "100",
  EEE: "40",
};

const previousPrices: PriceMap = {
  AAA: "110",
  BBB: "190",
  CCC: "55",
  DDD: "90",
  EEE: "40",
};

function closeTo(actual: Decimal, expected: string, tolerance = "1e-45") {
  expect(actual.minus(expected).abs().lt(tolerance)).toBe(true);
}

function percentSum(items: readonly { percent: Decimal | null }[]): Decimal {
  return items.reduce((sum, item) => sum.plus(item.percent ?? 0), new Decimal(0));
}

describe("portfolio-core hand-calculated fixture", () => {
  it("computes portfolio value, day change, and gain/loss", () => {
    expect(formatPercent("0.25")).toBe("25.00%");
    // Portfolio value: 2×120 + 1×180 + 3×60 + 2×100 + 1×40 = 840.
    expect(portfolioValue(holdings, currentPrices).eq("840")).toBe(true);

    // Prior value: 2×110 + 1×190 + 3×55 + 2×90 + 1×40 = 795.
    // Change: 840−795 = 45; fractional change: 45÷795 = 3÷53.
    const change = dayChange(holdings, currentPrices, previousPrices);
    expect(change.amount.eq("45")).toBe(true);
    closeTo(change.percent!, "0.05660377358490566037735849056603773584905660377358");
    expect(formatPercent(change.percent!)).toBe("5.66%");

    // Cost basis: 2×100 + 1×200 + 3×50 + 2×80 + 1×50 = 760.
    // Gain: 840−760 = 80; fractional gain: 80÷760 = 2÷19.
    const gain = gainLoss(holdings, currentPrices);
    expect(gain.amount.eq("80")).toBe(true);
    closeTo(gain.percent!, "0.10526315789473684210526315789473684210526315789474");
  });

  it("computes position and sector allocations and concentration", () => {
    const positions = allocationByPosition(holdings, currentPrices);
    // Position values: AAA=2×120=240, BBB=1×180=180, CCC=3×60=180,
    // DDD=2×100=200, EEE=1×40=40.
    // Fractions: AAA 240÷840=2÷7; BBB/CCC 180÷840=3÷14; DDD 200÷840=5÷21; EEE 40÷840=1÷21.
    closeTo(
      positions.find((item) => item.ticker === "AAA")!.percent!,
      "0.28571428571428571428571428571428571428571428571429",
    );
    closeTo(
      positions.find((item) => item.ticker === "BBB")!.percent!,
      "0.21428571428571428571428571428571428571428571428571",
    );
    expect(positions.find((item) => item.ticker === "CCC")!.value.eq("180")).toBe(true);
    closeTo(
      positions.find((item) => item.ticker === "CCC")!.percent!,
      "0.21428571428571428571428571428571428571428571428571",
    );
    expect(positions.find((item) => item.ticker === "DDD")!.value.eq("200")).toBe(true);
    closeTo(
      positions.find((item) => item.ticker === "DDD")!.percent!,
      "0.23809523809523809523809523809523809523809523809524",
    );
    expect(positions.find((item) => item.ticker === "EEE")!.value.eq("40")).toBe(true);
    closeTo(
      positions.find((item) => item.ticker === "EEE")!.percent!,
      "0.04761904761904761904761904761904761904761904761905",
    );
    expect(percentSum(positions).minus(1).abs().lt("1e-12")).toBe(true);

    // Sector fractions: Technology 420÷840=1/2; Consumer 180÷840=3/14;
    // Energy 200÷840=5/21; unknown 40÷840=1/21.
    const sectors = allocationBySector(holdings, currentPrices);
    expect(sectors.find((item) => item.sector === "Technology")!.value.eq("420")).toBe(true);
    expect(sectors.find((item) => item.sector === "Technology")!.percent!.eq("0.5")).toBe(true);
    expect(sectors.find((item) => item.sector === "Consumer")!.value.eq("180")).toBe(true);
    closeTo(
      sectors.find((item) => item.sector === "Consumer")!.percent!,
      "0.21428571428571428571428571428571428571428571428571",
    );
    expect(sectors.find((item) => item.sector === "Energy")!.value.eq("200")).toBe(true);
    closeTo(
      sectors.find((item) => item.sector === "Energy")!.percent!,
      "0.23809523809523809523809523809523809523809523809524",
    );
    expect(sectors.find((item) => item.sector === null)!.value.eq("40")).toBe(true);
    closeTo(
      sectors.find((item) => item.sector === null)!.percent!,
      "0.04761904761904761904761904761904761904761904761905",
    );
    expect(percentSum(sectors).minus(1).abs().lt("1e-12")).toBe(true);
    expect(formatPercent(sectors.find((item) => item.sector === "Technology")!.percent!)).toBe(
      "50.00%",
    );

    expect(largestPosition(holdings, currentPrices)?.ticker).toBe("AAA");
    // Unknown sector is excluded; Technology is 420÷840 = 0.5 of total portfolio value.
    const concentration = sectorConcentration(holdings, currentPrices);
    expect(concentration?.sector).toBe("Technology");
    expect(concentration?.value.eq("420")).toBe(true);
    expect(concentration?.percent?.eq("0.5")).toBe(true);
  });

  it("returns simple daily returns, annualized volatility, and max drawdown", () => {
    // Price series 100, 110, 99 gives returns (110÷100)-1=0.1 and (99÷110)-1=−0.1.
    const returns = dailyReturns(["100", "110", "99"]);
    expect(returns.map((value) => value.toString())).toEqual(["0.1", "-0.1"]);

    // Mean=0; sample variance=((0.1−0)^2+(−0.1−0)^2)/(2−1)=0.02.
    // Annualized volatility=sqrt(0.02)×sqrt(252)=sqrt(5.04)≈2.244994432064365.
    const volatility = annualizedVolatility(returns)!;
    closeTo(volatility, "2.244994432064365", "1e-12");

    // Peak 110 to trough 99 is (110−99)÷110=0.1 maximum drawdown.
    expect(maxDrawdown(["100", "110", "99"])?.eq("0.1")).toBe(true);
  });

  it("applies a tag-based scenario and returns scenario allocations", () => {
    // Growth-tag positions are AAA=240, BBB=180, EEE=40; +10% adds 24+18+4=46 to 840.
    // Scenario positions: AAA=240×1.1=264, BBB=180×1.1=198, CCC=180,
    // DDD=200, EEE=40×1.1=44; total=886.
    // Scenario sectors: Technology=264+198=462, Consumer=180, Energy=200, unknown=44.
    const result = runScenario(holdings, currentPrices, [
      { target: { type: "tag", value: "growth" }, changePercent: "0.1" },
    ]);
    expect(result.currentValue.eq("840")).toBe(true);
    expect(result.scenarioValue.eq("886")).toBe(true);
    expect(result.absoluteChange.eq("46")).toBe(true);
    expect(result.allocationByPosition.find((item) => item.ticker === "AAA")!.value.eq("264")).toBe(
      true,
    );
    expect(result.allocationByPosition.find((item) => item.ticker === "BBB")!.value.eq("198")).toBe(
      true,
    );
    expect(result.allocationByPosition.find((item) => item.ticker === "CCC")!.value.eq("180")).toBe(
      true,
    );
    expect(result.allocationByPosition.find((item) => item.ticker === "DDD")!.value.eq("200")).toBe(
      true,
    );
    expect(result.allocationByPosition.find((item) => item.ticker === "EEE")!.value.eq("44")).toBe(
      true,
    );
    // Scenario fractions: AAA=264÷886=132/443; Technology=462÷886=231/443.
    closeTo(
      result.allocationByPosition.find((item) => item.ticker === "AAA")!.percent!,
      "0.297968397291196388261851015801354401805",
      "1e-12",
    );
    expect(
      result.allocationBySector.find((item) => item.sector === "Technology")!.value.eq("462"),
    ).toBe(true);
    closeTo(
      result.allocationBySector.find((item) => item.sector === "Technology")!.percent!,
      "0.521444695259593679458239278555304740406",
      "1e-12",
    );
    expect(
      result.allocationBySector.find((item) => item.sector === "Consumer")!.value.eq("180"),
    ).toBe(true);
    expect(
      result.allocationBySector.find((item) => item.sector === "Energy")!.value.eq("200"),
    ).toBe(true);
    expect(result.allocationBySector.find((item) => item.sector === null)!.value.eq("44")).toBe(
      true,
    );
    expect(percentSum(result.allocationByPosition).minus(1).abs().lt("1e-12")).toBe(true);
    expect(percentSum(result.allocationBySector).minus(1).abs().lt("1e-12")).toBe(true);
  });
});

describe("portfolio-core edge cases", () => {
  it("keeps the shared Decimal constructor configuration unchanged", () => {
    expect(Decimal.precision).toBe(20);
    expect(Decimal.rounding).toBe(Decimal.ROUND_HALF_UP);
    expect(dailyReturns(["3", "1"])[0]!.toString()).toHaveLength(53);
  });

  it("returns explicit empty-portfolio values", () => {
    expect(portfolioValue([], {}).eq("0")).toBe(true);
    expect(allocationByPosition([], {})).toEqual([]);
    expect(allocationBySector([], {})).toEqual([]);
    expect(largestPosition([], {})).toBeNull();
    expect(sectorConcentration([], {})).toBeNull();
    expect(dayChange([], {}, {}).amount.eq("0")).toBe(true);
    expect(dayChange([], {}, {}).percent).toBeNull();
    expect(gainLoss([], {}).amount.eq("0")).toBe(true);
    expect(runScenario([], {}, []).scenarioValue.eq("0")).toBe(true);
    expect(runScenario([], {}, []).percentChange).toBeNull();
  });

  it("handles a single holding and zero prices without division by zero", () => {
    const one: Holding[] = [{ ticker: "ONE", shares: "1", avgCost: "0", sector: null }];
    expect(portfolioValue(one, { ONE: "0" }).eq("0")).toBe(true);
    expect(allocationByPosition(one, { ONE: "0" })[0]!.percent).toBeNull();
    expect(largestPosition(one, { ONE: "0" })?.ticker).toBe("ONE");
    expect(gainLoss(one, { ONE: "0" }).percent).toBeNull();
  });

  it("throws for missing prices, duplicate tickers, invalid shares, and negative cost", () => {
    const one: Holding[] = [{ ticker: "ONE", shares: "1", avgCost: "1" }];
    expect(() => portfolioValue(one, {})).toThrow(/missing price.*ONE/i);
    expect(() => portfolioValue([...one, ...one], { ONE: "1" })).toThrow(/duplicate ticker.*ONE/i);
    expect(() => portfolioValue([{ ...one[0]!, shares: "0" }], { ONE: "1" })).toThrow(
      /shares.*greater than zero/i,
    );
    expect(() => gainLoss([{ ...one[0]!, avgCost: "-1" }], { ONE: "1" })).toThrow(
      /avgCost.*non-negative/i,
    );
  });

  it("returns null volatility/drawdown when their minimum input lengths are not met", () => {
    expect(dailyReturns([])).toEqual([]);
    expect(dailyReturns(["100"])).toEqual([]);
    expect(annualizedVolatility([])).toBeNull();
    expect(annualizedVolatility(["0.1"])).toBeNull();
    expect(maxDrawdown([])).toBeNull();
    expect(maxDrawdown(["100"])).toBeNull();
    expect(() => dailyReturns(["0", "10"])).toThrow(/greater than zero for returns/i);
  });

  it("skips zero drawdown peaks and never divides by zero", () => {
    expect(maxDrawdown(["0", "0"])?.eq("0")).toBe(true);
    expect(maxDrawdown(["0", "10", "5"])?.eq("0.5")).toBe(true);
  });

  it("allows exactly -100% and rejects changes below -100%", () => {
    const result = runScenario([holdings[0]!], currentPrices, [
      { target: { type: "ticker", value: "AAA" }, changePercent: "-1" },
    ]);
    expect(result.scenarioValue.eq("0")).toBe(true);
    expect(() =>
      runScenario([holdings[0]!], currentPrices, [
        { target: { type: "ticker", value: "AAA" }, changePercent: "-1.01" },
      ]),
    ).toThrow(/cannot be less than -100%/i);
  });

  it("compounds ticker and multiple tag matches on the same holding", () => {
    const overlapping: Holding[] = [
      {
        ticker: "AAA",
        shares: "1",
        avgCost: "0",
        tags: ["growth", "technology", "growth"],
      },
    ];
    const result = runScenario(overlapping, { AAA: "100" }, [
      { target: { type: "ticker", value: "AAA" }, changePercent: "0.1" },
      { target: { type: "tag", value: "growth" }, changePercent: "0.2" },
      { target: { type: "tag", value: "technology" }, changePercent: "0.3" },
    ]);
    // 100×1.1×1.2×1.3 = 171.6; tag overlap applies once per matching change, not once per tag.
    expect(result.scenarioValue.eq("171.6")).toBe(true);
  });

  it("compares ticker strings exactly and keeps missing sectors in allocation output", () => {
    const caseSensitive: Holding[] = [
      { ticker: "ABC", shares: "1", avgCost: "1", sector: "Tech" },
      { ticker: "abc", shares: "1", avgCost: "1", sector: null },
    ];
    expect(portfolioValue(caseSensitive, { ABC: "2", abc: "3" }).eq("5")).toBe(true);
    expect(allocationBySector(caseSensitive, { ABC: "2", abc: "3" })).toHaveLength(2);
    expect(sectorConcentration(caseSensitive, { ABC: "2", abc: "3" })?.percent?.eq("0.4")).toBe(
      true,
    );

    const unknownOnly: Holding[] = [{ ticker: "UNK", shares: "1", avgCost: "1" }];
    expect(sectorConcentration(unknownOnly, { UNK: "5" })).toBeNull();
  });
});

describe("portfolio-core properties", () => {
  it("keeps position and sector allocations within tolerance of 100% for nonzero portfolios", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 })), {
          minLength: 1,
          maxLength: 8,
        }),
        (rows) => {
          const generated: Holding[] = rows.map(([shares], index) => ({
            ticker: `T${index}`,
            shares: String(shares),
            avgCost: "0",
            sector: index % 2 === 0 ? "Even" : "Odd",
          }));
          const generatedPrices = Object.fromEntries(
            rows.map(([, price], index) => [`T${index}`, String(price)]),
          );
          const tolerance = new Decimal("1e-12");
          const positionSum = percentSum(allocationByPosition(generated, generatedPrices));
          const sectorSum = percentSum(allocationBySector(generated, generatedPrices));
          return (
            positionSum.minus(1).abs().lte(tolerance) && sectorSum.minus(1).abs().lte(tolerance)
          );
        },
      ),
    );
  });

  it("makes a zero-percent scenario equal current value and allocations", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 })), {
          minLength: 1,
          maxLength: 8,
        }),
        (rows) => {
          const generated: Holding[] = rows.map(([shares], index) => ({
            ticker: `T${index}`,
            shares: String(shares),
            avgCost: "0",
            sector: index % 2 === 0 ? "Even" : "Odd",
            tags: ["x"],
          }));
          const prices: PriceMap = Object.fromEntries(
            rows.map(([, price], index) => [`T${index}`, String(price)]),
          );
          const current = portfolioValue(generated, prices);
          const result = runScenario(generated, prices, [
            { target: { type: "tag", value: "x" }, changePercent: "0" },
          ]);
          return (
            result.scenarioValue.eq(current) &&
            percentSum(result.allocationByPosition).minus(1).abs().lte("1e-12") &&
            percentSum(result.allocationBySector).minus(1).abs().lte("1e-12")
          );
        },
      ),
    );
  });

  it("removes exactly one position's value at -100%", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (firstShares, firstPrice, secondPrice) => {
          const generated: Holding[] = [
            { ticker: "A", shares: String(firstShares), avgCost: "0" },
            { ticker: "B", shares: "1", avgCost: "0" },
          ];
          const prices: PriceMap = { A: String(firstPrice), B: String(secondPrice) };
          const current = portfolioValue(generated, prices);
          const removed = new Decimal(firstShares).times(firstPrice);
          const result = runScenario(generated, prices, [
            { target: { type: "ticker", value: "A" }, changePercent: "-1" },
          ]);
          return result.scenarioValue.eq(current.minus(removed));
        },
      ),
    );
  });
});
