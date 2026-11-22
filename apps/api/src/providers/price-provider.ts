import { z } from "zod";

export const TickerSymbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9.-]{0,14}$/, "Invalid ticker symbol");

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");

export const PriceAmountSchema = z
  .union([
    z.number().finite().nonnegative(),
    z.string().regex(/^\d{1,12}(?:\.\d{1,8})?$/, "Price exceeds database precision"),
  ])
  .transform(String)
  .pipe(z.string().regex(/^\d{1,12}(?:\.\d{1,8})?$/, "Price exceeds database precision"));

export const PriceBarSchema = z.object({
  ticker: TickerSymbolSchema,
  date: calendarDateSchema,
  close: PriceAmountSchema,
  adj_close: PriceAmountSchema.nullable(),
  volume: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
});

export const PriceBarListSchema = z.array(PriceBarSchema);

export const TickerMetadataSchema = z.object({
  symbol: TickerSymbolSchema,
  name: z.string().trim().min(1),
  sector: z.string().trim().min(1).nullable(),
  industry: z.string().trim().min(1).nullable(),
  currency: z.literal("USD"),
  exchange: z.string().trim().min(1).nullable(),
});

export interface PriceProvider {
  fetchDailyPrices(symbol: string, fromDate: string, throughDate: string): Promise<unknown>;
  fetchTickerMetadata(symbol: string): Promise<unknown>;
}

export type PriceBar = z.infer<typeof PriceBarSchema>;
export type TickerMetadata = z.infer<typeof TickerMetadataSchema>;
