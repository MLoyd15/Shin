import { describe, expect, it, vi } from "vitest";
import type { PriceProvider } from "../providers/price-provider.js";
import type { PriceCacheRow } from "../repositories/prices.js";
import { latestCompletedTradingDate, previousTradingDate } from "./market-calendar.js";
import { PricesService, PricesServiceError } from "./prices.js";

const now = new Date("2026-11-23T23:00:00.000Z");
const latestDate = latestCompletedTradingDate(now);
const previousDate = previousTradingDate(latestDate);
const olderDate = previousTradingDate(previousDate);

function bar(ticker: string, date: string, close: string) {
  return { ticker, date, close, adj_close: close, volume: 100 };
}

function cached(ticker: string, date: string, close: string, fetchedAt: string): PriceCacheRow {
  return {
    ticker,
    date,
    close,
    adj_close: close,
    volume: 100,
    fetched_at: fetchedAt,
  };
}

function makeProvider(fetchDailyPrices: PriceProvider["fetchDailyPrices"]): PriceProvider {
  return {
    fetchDailyPrices,
    fetchTickerMetadata: async () => ({
      symbol: "AAPL",
      name: "Apple Inc.",
      sector: "Technology",
      industry: "Consumer Electronics",
      currency: "USD",
      exchange: "NasdaqGS",
    }),
  };
}

describe("prices service", () => {
  it("serves a complete fresh cache without calling the live provider", async () => {
    const provider = makeProvider(vi.fn());
    const repository = {
      listLatest: vi.fn(async () => [
        cached("AAPL", latestDate, "270.12", "2026-11-23T22:00:00.000Z"),
        cached("AAPL", previousDate, "268.45", "2026-11-23T22:00:00.000Z"),
      ]),
    };
    const service = new PricesService(repository, provider, { now: () => now });

    await expect(service.getForTickers(["AAPL"])).resolves.toEqual([
      {
        ticker: "AAPL",
        latestClose: "270.12",
        previousClose: "268.45",
        asOf: latestDate,
        fetchedAt: "2026-11-23T22:00:00.000Z",
        stale: false,
        history: [
          { date: previousDate, close: "268.45" },
          { date: latestDate, close: "270.12" },
        ],
      },
    ]);
    expect(provider.fetchDailyPrices).not.toHaveBeenCalled();
  });

  it("fetches each distinct missing ticker once and writes validated cache rows", async () => {
    const fetchDailyPrices = vi.fn(async (ticker: string) => [
      bar(ticker, latestDate, "270.12"),
      bar(ticker, previousDate, "268.45"),
      bar(ticker, olderDate, "266.10"),
    ]);
    const provider = makeProvider(fetchDailyPrices);
    const repository = { listLatest: vi.fn(async () => []) };
    const writeCache = vi.fn(async () => undefined);
    const service = new PricesService(repository, provider, { now: () => now, writeCache });

    const result = await service.getForTickers(["aapl", "AAPL"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ticker: "AAPL",
      latestClose: "270.12",
      previousClose: "268.45",
      asOf: latestDate,
      fetchedAt: now.toISOString(),
      stale: false,
      history: [
        { date: olderDate, close: "266.10" },
        { date: previousDate, close: "268.45" },
        { date: latestDate, close: "270.12" },
      ],
    });
    expect(fetchDailyPrices).toHaveBeenCalledTimes(1);
    expect(writeCache).toHaveBeenCalledTimes(1);
  });

  it("labels cached data stale from fetched_at and serves it if the provider is unavailable", async () => {
    const provider = makeProvider(async () => {
      throw new Error("provider is down");
    });
    const repository = {
      listLatest: vi.fn(async () => [
        cached("AAPL", previousDate, "268.45", "2026-11-23T20:59:00.000Z"),
      ]),
    };
    const service = new PricesService(repository, provider, { now: () => now });

    await expect(service.getForTickers(["AAPL"])).resolves.toEqual([
      {
        ticker: "AAPL",
        latestClose: "268.45",
        previousClose: null,
        asOf: previousDate,
        fetchedAt: "2026-11-23T20:59:00.000Z",
        stale: true,
        history: [{ date: previousDate, close: "268.45" }],
        warning: "Live prices were unavailable; showing stale cached data.",
      },
    ]);
  });

  it("reports missing tickers and invalid provider data instead of inventing prices", async () => {
    const repository = { listLatest: vi.fn(async () => []) };
    const missing = new PricesService(
      makeRepository(repository),
      makeProvider(async () => []),
      {
        now: () => now,
      },
    );
    await expect(missing.getForTickers(["ZZZ"])).rejects.toMatchObject({
      status: 404,
      message: "No end-of-day prices were found for ZZZ",
    });

    const garbage = new PricesService(
      makeRepository(repository),
      makeProvider(async () => [{ ticker: "AAPL", close: "garbage" }]),
      { now: () => now },
    );
    await expect(garbage.getForTickers(["AAPL"])).rejects.toBeInstanceOf(PricesServiceError);
  });
});

function makeRepository(repository: { listLatest: (ticker: string) => Promise<PriceCacheRow[]> }) {
  return repository;
}
