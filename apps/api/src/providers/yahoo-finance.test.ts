import { describe, expect, it, vi } from "vitest";
import { YahooFinancePriceProvider, type YahooFinanceClient } from "./yahoo-finance.js";

const recordedChartResponse = {
  meta: {
    currency: "USD",
    symbol: "AAPL",
    exchangeTimezoneName: "America/New_York",
  },
  quotes: [
    {
      date: new Date("2026-11-19T21:00:00.000Z"),
      close: 268.45,
      adjclose: 268.45,
      volume: 48200100,
    },
    {
      date: new Date("2026-11-20T21:00:00.000Z"),
      close: 270.12,
      adjclose: 270.12,
      volume: 45100200,
    },
    {
      date: new Date("2026-11-23T21:00:00.000Z"),
      close: 271.5,
      adjclose: 271.5,
      volume: 40000000,
    },
  ],
};

const recordedSummaryResponse = {
  price: {
    symbol: "AAPL",
    currency: "USD",
    longName: "Apple Inc.",
    shortName: "Apple",
    exchangeName: "NasdaqGS",
  },
  assetProfile: {
    sector: "Technology",
    industry: "Consumer Electronics",
  },
};

function makeClient(chartResponse: unknown, summaryResponse: unknown): YahooFinanceClient {
  return {
    chart: vi.fn().mockResolvedValue(chartResponse),
    quoteSummary: vi.fn().mockResolvedValue(summaryResponse),
  } as unknown as YahooFinanceClient;
}

describe("Yahoo Finance provider recorded-response contract", () => {
  it("normalizes daily chart quotes to exchange dates and excludes dates after the requested close", async () => {
    const client = makeClient(recordedChartResponse, recordedSummaryResponse);
    const provider = new YahooFinancePriceProvider(client);

    await expect(provider.fetchDailyPrices("AAPL", "2026-11-19", "2026-11-20")).resolves.toEqual([
      {
        ticker: "AAPL",
        date: "2026-11-19",
        close: "268.45",
        adj_close: "268.45",
        volume: 48200100,
      },
      {
        ticker: "AAPL",
        date: "2026-11-20",
        close: "270.12",
        adj_close: "270.12",
        volume: 45100200,
      },
    ]);
    expect(client.chart).toHaveBeenCalledWith(
      "AAPL",
      expect.objectContaining({ interval: "1d", return: "array" }),
    );
  });

  it("validates and normalizes provider ticker metadata", async () => {
    const client = makeClient(recordedChartResponse, recordedSummaryResponse);
    const provider = new YahooFinancePriceProvider(client);

    await expect(provider.fetchTickerMetadata("AAPL")).resolves.toEqual({
      symbol: "AAPL",
      name: "Apple Inc.",
      sector: "Technology",
      industry: "Consumer Electronics",
      currency: "USD",
      exchange: "NasdaqGS",
    });
    expect(client.quoteSummary).toHaveBeenCalledWith("AAPL", {
      modules: ["price", "assetProfile"],
    });
  });

  it("rejects malformed or non-USD provider responses", async () => {
    const malformed = new YahooFinancePriceProvider(makeClient({ meta: null, quotes: [] }, {}));
    await expect(malformed.fetchDailyPrices("AAPL", "2026-11-19", "2026-11-20")).rejects.toThrow();

    const foreign = new YahooFinancePriceProvider(
      makeClient(
        { ...recordedChartResponse, meta: { ...recordedChartResponse.meta, currency: "EUR" } },
        recordedSummaryResponse,
      ),
    );
    await expect(foreign.fetchDailyPrices("AAPL", "2026-11-19", "2026-11-20")).rejects.toThrow(
      /non-USD/i,
    );
  });
});
