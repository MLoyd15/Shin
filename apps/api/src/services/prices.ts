import { HoldingTickerSchema } from "@folioagent/shared";
import {
  PriceBarListSchema,
  type PriceBar,
  type PriceProvider,
} from "../providers/price-provider.js";
import {
  type PriceCacheRow,
  type PriceCacheWrite,
  toPriceCacheWrites,
} from "../repositories/prices.js";
import {
  addCalendarDays,
  fetchedAfterMarketClose,
  latestCompletedTradingDate,
  previousTradingDate,
} from "./market-calendar.js";

export interface PriceCacheReader {
  listLatest(ticker: string, limit?: number): Promise<PriceCacheRow[]>;
}

export type PriceCacheWriter = (rows: readonly PriceCacheWrite[]) => Promise<void>;

export interface TickerPrice {
  ticker: string;
  latestClose: string;
  previousClose: string | null;
  asOf: string;
  fetchedAt: string;
  stale: boolean;
  history: PriceHistoryPoint[];
  warning?: "Live prices were unavailable; showing stale cached data.";
}

export interface PriceHistoryPoint {
  date: string;
  close: string;
}

export class PricesServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PricesServiceError";
  }
}

export interface PricesServiceOptions {
  now?: () => Date;
  writeCache?: PriceCacheWriter;
}

export class PricesService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: PriceCacheReader,
    private readonly provider: PriceProvider,
    private readonly options: PricesServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async getForTickers(rawTickers: readonly string[]): Promise<TickerPrice[]> {
    const tickers = [
      ...new Set(rawTickers.map((ticker) => HoldingTickerSchema.parse(ticker))),
    ].sort();
    return Promise.all(tickers.map((ticker) => this.getForTicker(ticker)));
  }

  private async getForTicker(ticker: string): Promise<TickerPrice> {
    const now = this.now();
    const expectedLatest = latestCompletedTradingDate(now);
    const expectedPrevious = previousTradingDate(expectedLatest);
    const cached = await this.repository.listLatest(ticker);
    const relevantCached = cached.filter((row) => row.date <= expectedLatest);
    const cachedByDate = new Map(cached.map((row) => [row.date, row]));
    const cachedLatest = cachedByDate.get(expectedLatest);
    const cachedPrevious = cachedByDate.get(expectedPrevious);
    if (
      cachedLatest &&
      cachedPrevious &&
      fetchedAfterMarketClose(cachedLatest.fetched_at, expectedLatest)
    ) {
      const history = this.selectHistory([], relevantCached, expectedLatest);
      return this.toTickerPrice(
        ticker,
        this.selectLatestAndPrevious([], relevantCached, expectedLatest),
        cachedLatest.fetched_at,
        expectedLatest,
        false,
        history,
      );
    }

    const fromDate = addCalendarDays(expectedLatest, -30);
    let bars: PriceBar[];
    try {
      bars = PriceBarListSchema.parse(
        await this.provider.fetchDailyPrices(ticker, fromDate, expectedLatest),
      );
      if (bars.some((bar) => bar.ticker !== ticker)) {
        throw new Error(`Price provider returned a different ticker for ${ticker}`);
      }
      bars = bars
        .filter((bar) => bar.date >= fromDate && bar.date <= expectedLatest)
        .sort((left, right) => right.date.localeCompare(left.date));
      const byDate = new Map<string, PriceBar>();
      for (const bar of bars) {
        if (byDate.has(bar.date))
          throw new Error(`Price provider returned duplicate ${ticker} prices`);
        byDate.set(bar.date, bar);
      }
      bars = [...byDate.values()];
      if (!bars.length)
        throw new PricesServiceError(404, `No end-of-day prices were found for ${ticker}`);
    } catch (error) {
      if (relevantCached.length) {
        const history = this.selectHistory([], relevantCached, expectedLatest);
        return this.toTickerPrice(
          ticker,
          this.selectLatestAndPrevious([], relevantCached, expectedLatest),
          relevantCached[0]?.fetched_at ?? "",
          expectedLatest,
          true,
          history,
        );
      }
      if (error instanceof PricesServiceError) throw error;
      throw new PricesServiceError(503, `Prices are unavailable for ${ticker}`, { cause: error });
    }

    const fetchedAt = now.toISOString();
    if (this.options.writeCache) {
      try {
        await this.options.writeCache(toPriceCacheWrites(bars, fetchedAt));
      } catch (error) {
        throw new PricesServiceError(503, `Price cache could not be updated for ${ticker}`, {
          cause: error,
        });
      }
    }

    const history = this.selectHistory(bars, cached, expectedLatest);
    const selected = this.selectLatestAndPrevious(bars, cached, expectedLatest);
    if (!selected.length) {
      throw new PricesServiceError(404, `No end-of-day prices were found for ${ticker}`);
    }
    return this.toTickerPrice(ticker, selected, fetchedAt, expectedLatest, false, history);
  }

  private selectHistory(
    providerBars: readonly PriceBar[],
    cached: readonly PriceCacheRow[],
    expectedLatest: string,
  ): PriceBar[] {
    const byDate = new Map<string, PriceBar>();
    for (const row of cached) byDate.set(row.date, toBar(row));
    for (const bar of providerBars) byDate.set(bar.date, bar);
    return [...byDate.values()]
      .filter((bar) => bar.date <= expectedLatest)
      .sort((left, right) => right.date.localeCompare(left.date));
  }

  private selectLatestAndPrevious(
    providerBars: readonly PriceBar[],
    cached: readonly PriceCacheRow[],
    expectedLatest: string,
  ): PriceBar[] {
    const history = this.selectHistory(providerBars, cached, expectedLatest);
    const latest = history[0];
    if (!latest) return [];
    const previous = history.find((bar) => bar.date === previousTradingDate(latest.date));
    return previous ? [latest, previous] : [latest];
  }

  private toTickerPrice(
    ticker: string,
    bars: readonly PriceBar[],
    fetchedAt: string,
    expectedLatest: string,
    forceStale = false,
    history: readonly PriceBar[] = bars,
  ): TickerPrice {
    const latest = bars[0];
    if (!latest) throw new PricesServiceError(404, `No end-of-day prices were found for ${ticker}`);
    return {
      ticker,
      latestClose: String(latest.close),
      previousClose: bars[1] ? String(bars[1].close) : null,
      asOf: latest.date,
      fetchedAt,
      stale:
        forceStale ||
        latest.date < expectedLatest ||
        !fetchedAfterMarketClose(fetchedAt, expectedLatest),
      history: [...history]
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((bar) => ({ date: bar.date, close: String(bar.close) })),
      ...(forceStale
        ? { warning: "Live prices were unavailable; showing stale cached data." as const }
        : {}),
    };
  }
}

function toBar(row: PriceCacheRow): PriceBar {
  return {
    ticker: row.ticker,
    date: row.date,
    close: row.close,
    adj_close: row.adj_close,
    volume: row.volume,
  };
}
