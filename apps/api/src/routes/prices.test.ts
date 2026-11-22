import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PriceProvider } from "../providers/price-provider.js";
import { createApp } from "../app.js";
import { createPricesRouter } from "./prices.js";
import { latestCompletedTradingDate, previousTradingDate } from "../services/market-calendar.js";

const userId = "00000000-0000-4000-8000-000000000001";
const now = new Date();
const latestDate = latestCompletedTradingDate(now);
const previousDate = previousTradingDate(latestDate);
const provider: PriceProvider = {
  fetchDailyPrices: vi.fn(async (ticker: string) => [
    { ticker, date: latestDate, close: "270.12", adj_close: "270.12", volume: 100 },
    { ticker, date: previousDate, close: "268.45", adj_close: "268.45", volume: 90 },
  ]),
  fetchTickerMetadata: async () => ({
    symbol: "AAPL",
    name: "Apple Inc.",
    sector: "Technology",
    industry: "Consumer Electronics",
    currency: "USD",
    exchange: "NasdaqGS",
  }),
};

const cacheWrites = vi.fn(async () => undefined);
const databasePaths: string[] = [];
const supabaseFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.pathname === "/auth/v1/user") {
    return Response.json({
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "investor@example.test",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    });
  }
  databasePaths.push(url.pathname);
  if (url.pathname === "/rest/v1/holdings")
    return Response.json([{ ticker: "AAPL" }, { ticker: "AAPL" }]);
  if (url.pathname === "/rest/v1/price_cache") return Response.json([]);
  return Response.json({ message: "Not found" }, { status: 404 });
};

describe("GET /api/prices", () => {
  const app = createApp({
    apiRouter: createPricesRouter({
      provider,
      now: () => now,
      writeCache: cacheWrites,
    }),
    auth: {
      supabaseUrl: "http://supabase.test",
      supabaseAnonKey: "test-key",
      fetch: supabaseFetch,
    },
  });
  let server: ReturnType<typeof app.listen>;
  let baseUrl = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns unique prices for the authenticated user's holdings and writes the cache", async () => {
    const response = await fetch(`${baseUrl}/api/prices`, {
      headers: { Authorization: "Bearer user-a-token" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      prices: [
        {
          ticker: "AAPL",
          latestClose: "270.12",
          previousClose: "268.45",
          asOf: latestDate,
          fetchedAt: now.toISOString(),
          stale: false,
          history: [
            { date: previousDate, close: "268.45" },
            { date: latestDate, close: "270.12" },
          ],
        },
      ],
    });
    expect(provider.fetchDailyPrices).toHaveBeenCalledTimes(1);
    expect(cacheWrites).toHaveBeenCalledTimes(1);
    expect(databasePaths).toContain("/rest/v1/holdings");
    expect(databasePaths).toContain("/rest/v1/price_cache");
  });
});
