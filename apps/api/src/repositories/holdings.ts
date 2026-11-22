import type { SupabaseClient } from "@supabase/supabase-js";

export interface HoldingTicker {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  currency: string;
}

export interface StoredHolding {
  user_id: string;
  ticker: string;
  shares: string;
  avg_cost: string;
  tags: string[];
}

export type HoldingWrite = Omit<StoredHolding, "user_id">;

export class HoldingsRepositoryError extends Error {
  constructor(readonly code: string | undefined, message: string) {
    super(message);
    this.name = "HoldingsRepositoryError";
  }
}

export class HoldingsRepository {
  constructor(private readonly client: SupabaseClient, private readonly userId: string) {}

  private unwrap<T>(result: { data: T | null; error: { code?: string; message: string } | null }): T | null {
    if (result.error) throw new HoldingsRepositoryError(result.error.code, result.error.message);
    return result.data;
  }

  async list(): Promise<StoredHolding[]> {
    const result = await this.client.from("holdings").select("user_id,ticker,shares,avg_cost,tags")
      .eq("user_id", this.userId).order("ticker");
    return (this.unwrap(result) ?? []) as StoredHolding[];
  }

  async findTicker(symbol: string): Promise<HoldingTicker | null> {
    const result = await this.client.from("tickers").select("symbol,name,sector,industry,currency")
      .eq("symbol", symbol).maybeSingle();
    return this.unwrap(result) as HoldingTicker | null;
  }

  async findTickers(symbols: readonly string[]): Promise<HoldingTicker[]> {
    if (!symbols.length) return [];
    const result = await this.client.from("tickers").select("symbol,name,sector,industry,currency")
      .in("symbol", [...symbols]);
    return (this.unwrap(result) ?? []) as HoldingTicker[];
  }

  async findExistingTickers(symbols: readonly string[]): Promise<string[]> {
    if (!symbols.length) return [];
    const result = await this.client.from("holdings").select("ticker")
      .eq("user_id", this.userId).in("ticker", [...symbols]);
    return ((this.unwrap(result) ?? []) as Array<{ ticker: string }>).map((row) => row.ticker);
  }

  async create(row: HoldingWrite): Promise<StoredHolding> {
    const result = await this.client.from("holdings").insert({ ...row, user_id: this.userId })
      .select("user_id,ticker,shares,avg_cost,tags").single();
    const createdRow = this.unwrap(result);
    if (!createdRow) throw new HoldingsRepositoryError(undefined, "Supabase returned no created row");
    return createdRow as StoredHolding;
  }

  async insertMany(rows: readonly HoldingWrite[]): Promise<StoredHolding[]> {
    if (!rows.length) return [];
    const result = await this.client.from("holdings").insert(rows.map((row) => ({ ...row, user_id: this.userId })))
      .select("user_id,ticker,shares,avg_cost,tags");
    return (this.unwrap(result) ?? []) as StoredHolding[];
  }

  async update(symbol: string, fields: Partial<Pick<HoldingWrite, "shares" | "avg_cost" | "tags">>): Promise<StoredHolding | null> {
    const result = await this.client.from("holdings").update(fields).eq("user_id", this.userId).eq("ticker", symbol)
      .select("user_id,ticker,shares,avg_cost,tags").maybeSingle();
    return this.unwrap(result) as StoredHolding | null;
  }

  async delete(symbol: string): Promise<boolean> {
    const result = await this.client.from("holdings").delete().eq("user_id", this.userId).eq("ticker", symbol)
      .select("ticker");
    return ((this.unwrap(result) ?? []) as Array<{ ticker: string }>).length > 0;
  }
}
