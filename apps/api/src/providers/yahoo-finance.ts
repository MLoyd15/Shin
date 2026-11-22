import YahooFinance from "yahoo-finance2";
import type { ChartOptionsWithReturnArray, ChartResultArray } from "yahoo-finance2/modules/chart";
import type { QuoteSummaryOptions, QuoteSummaryResult } from "yahoo-finance2/modules/quoteSummary";
import { z } from "zod";
import {
  PriceBarListSchema,
  PriceBarSchema,
  TickerMetadataSchema,
  type PriceBar,
  type PriceProvider,
  type TickerMetadata,
} from "./price-provider.js";

const YahooChartResponseSchema = z.object({
  meta: z.object({
    currency: z.string().min(1),
    symbol: z.string().min(1),
    exchangeTimezoneName: z.string().min(1),
  }),
  quotes: z.array(
    z.object({
      date: z.date(),
      close: z.number().finite().nonnegative().nullable(),
      adjclose: z.number().finite().nonnegative().nullable().optional(),
      volume: z.number().finite().int().nonnegative().nullable().optional(),
    }),
  ),
});

const YahooSummaryResponseSchema = z.object({
  price: z
    .object({
      symbol: z.string().min(1),
      currency: z.string().min(1),
      longName: z.string().nullable().optional(),
      shortName: z.string().nullable().optional(),
      exchangeName: z.string().nullable().optional(),
    })
    .optional(),
  assetProfile: z
    .object({
      sector: z.string().nullable().optional(),
      industry: z.string().nullable().optional(),
    })
    .optional(),
});

export interface YahooFinanceClient {
  chart(symbol: string, options: ChartOptionsWithReturnArray): Promise<ChartResultArray>;
  quoteSummary(symbol: string, options: QuoteSummaryOptions): Promise<QuoteSummaryResult>;
}

export class YahooFinancePriceProvider implements PriceProvider {
  private readonly client: YahooFinanceClient;

  constructor(client?: YahooFinanceClient) {
    const instance = new YahooFinance();
    this.client = client ?? {
      chart: (symbol, options) => instance.chart(symbol, options),
      quoteSummary: (symbol, options) => instance.quoteSummary(symbol, options),
    };
  }

  async fetchDailyPrices(
    symbol: string,
    fromDate: string,
    throughDate: string,
  ): Promise<PriceBar[]> {
    const period1 = new Date(`${fromDate}T00:00:00.000Z`);
    const period2 = new Date(`${throughDate}T00:00:00.000Z`);
    period2.setUTCDate(period2.getUTCDate() + 1);
    const raw = await this.client.chart(symbol, {
      period1,
      period2,
      interval: "1d",
      return: "array",
    });
    const response = YahooChartResponseSchema.parse(raw);
    if (response.meta.symbol.toUpperCase() !== symbol.toUpperCase()) {
      throw new Error(`Yahoo returned ${response.meta.symbol} for ${symbol}`);
    }
    if (response.meta.currency !== "USD") {
      throw new Error(`Yahoo returned non-USD prices for ${symbol}`);
    }

    const rows = response.quotes.flatMap((quote) => {
      if (quote.close === null) return [];
      const date = dateInTimeZone(quote.date, response.meta.exchangeTimezoneName);
      if (date < fromDate || date > throughDate) return [];
      return [
        PriceBarSchema.parse({
          ticker: symbol,
          date,
          close: String(quote.close),
          adj_close: quote.adjclose == null ? null : String(quote.adjclose),
          volume: quote.volume ?? null,
        }),
      ];
    });

    return PriceBarListSchema.parse(rows).sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  }

  async fetchTickerMetadata(symbol: string): Promise<TickerMetadata> {
    const raw = await this.client.quoteSummary(symbol, {
      modules: ["price", "assetProfile"],
    });
    const response = YahooSummaryResponseSchema.parse(raw);
    const price = response.price;
    if (!price || price.symbol.toUpperCase() !== symbol.toUpperCase()) {
      throw new Error(`Yahoo returned no matching ticker metadata for ${symbol}`);
    }

    return TickerMetadataSchema.parse({
      symbol,
      name: price.longName ?? price.shortName,
      sector: response.assetProfile?.sector ?? null,
      industry: response.assetProfile?.industry ?? null,
      currency: price.currency,
      exchange: price.exchangeName ?? null,
    });
  }
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = values["year"];
  const month = values["month"];
  const day = values["day"];
  if (!year || !month || !day) throw new Error(`Yahoo returned an invalid timezone: ${timeZone}`);
  return `${year}-${month}-${day}`;
}
