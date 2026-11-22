import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { PriceAmountSchema, type PriceBar } from "../providers/price-provider.js";

const priceCacheRowSchema = z.object({
  ticker: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  close: PriceAmountSchema,
  adj_close: PriceAmountSchema.nullable(),
  volume: z.number().int().nonnegative().nullable(),
  fetched_at: z.string().datetime({ offset: true }),
});

const priceCacheRowsSchema = z.array(priceCacheRowSchema);

export type PriceCacheRow = z.infer<typeof priceCacheRowSchema>;

export interface PriceCacheWrite {
  ticker: string;
  date: string;
  close: string;
  adj_close: string | null;
  volume: number | null;
  fetched_at: string;
}

export class PricesRepositoryError extends Error {
  constructor(
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "PricesRepositoryError";
  }
}

export class PricesRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listLatest(ticker: string, limit = 30): Promise<PriceCacheRow[]> {
    const result = await this.client
      .from("price_cache")
      .select("ticker,date,close,adj_close,volume,fetched_at")
      .eq("ticker", ticker)
      .order("date", { ascending: false })
      .limit(limit);
    if (result.error) throw new PricesRepositoryError(result.error.code, result.error.message);
    return priceCacheRowsSchema.parse(result.data ?? []);
  }

  async upsertPrices(rows: readonly PriceCacheWrite[]): Promise<void> {
    if (!rows.length) return;
    const result = await this.client
      .from("price_cache")
      .upsert(rows, { onConflict: "ticker,date" });
    if (result.error) throw new PricesRepositoryError(result.error.code, result.error.message);
  }

  async listHeldTickers(): Promise<string[]> {
    const result = await this.client.from("holdings").select("ticker").order("ticker");
    if (result.error) throw new PricesRepositoryError(result.error.code, result.error.message);
    const rows = z.array(z.object({ ticker: z.string() })).parse(result.data ?? []);
    return [...new Set(rows.map((row) => row.ticker))];
  }
}

export function toPriceCacheWrites(
  bars: readonly PriceBar[],
  fetchedAt: string,
): PriceCacheWrite[] {
  return bars.map((bar) => ({
    ticker: bar.ticker,
    date: bar.date,
    close: bar.close,
    adj_close: bar.adj_close,
    volume: bar.volume,
    fetched_at: fetchedAt,
  }));
}
