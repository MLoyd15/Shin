import { describe, expect, it, vi } from "vitest";
import type { PriceProvider } from "../providers/price-provider.js";
import { latestCompletedTradingDate, previousTradingDate } from "../services/market-calendar.js";
import { runPricePipeline, type PricePipelineRepository } from "./run-price-pipeline.js";

describe("manual price pipeline job", () => {
  it("upserts provider ticker metadata before static price rows and logs the metadata", async () => {
    const now = new Date("2026-11-23T23:00:00.000Z");
    const latestDate = latestCompletedTradingDate(now);
    const previousDate = previousTradingDate(latestDate);
    const repository: PricePipelineRepository = {
      upsertPrices: vi.fn(async () => undefined),
    };
    const upsertTicker = vi.fn(async () => undefined);
    const provider: PriceProvider = {
      fetchTickerMetadata: vi.fn(async (symbol: string) => ({
        symbol,
        name: "Apple Inc.",
        sector: "Technology",
        industry: "Consumer Electronics",
        currency: "USD",
        exchange: "NasdaqGS",
      })),
      fetchDailyPrices: vi.fn(async (symbol: string) => [
        { ticker: symbol, date: latestDate, close: "270.12", adj_close: "270.12", volume: 100 },
        { ticker: symbol, date: previousDate, close: "268.45", adj_close: "268.45", volume: 90 },
      ]),
    };
    const log = { info: vi.fn() };

    await runPricePipeline([" aapl ", "AAPL"], {
      repository,
      upsertTicker,
      provider,
      now: () => now,
      log,
    });

    expect(provider.fetchTickerMetadata).toHaveBeenCalledTimes(1);
    expect(provider.fetchDailyPrices).toHaveBeenCalledTimes(1);
    expect(upsertTicker).toHaveBeenCalledWith(
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        sector: "Technology",
        industry: "Consumer Electronics",
        currency: "USD",
        exchange: "NasdaqGS",
      },
      now.toISOString(),
    );
    expect(repository.upsertPrices).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: "AAPL", name: "Apple Inc." }),
      "Upserted ticker metadata from provider",
    );
  });
});
