import { describe, expect, it, vi } from "vitest";
import type { PriceProvider } from "../providers/price-provider.js";
import {
  PriceProviderCooldownError,
  PriceProviderUnavailableError,
  RetryingPriceProvider,
} from "./retrying-price-provider.js";

describe("retrying price provider", () => {
  it("retries with exponential jitter and opens a cooldown after repeated failed requests", async () => {
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const provider: PriceProvider = {
      fetchDailyPrices: vi.fn(async () => {
        throw new Error("recorded provider outage");
      }),
      fetchTickerMetadata: vi.fn(async () => {
        throw new Error("recorded provider outage");
      }),
    };
    const retrying = new RetryingPriceProvider(
      provider,
      {
        attempts: 2,
        baseDelayMs: 100,
        maxDelayMs: 500,
        failureThreshold: 2,
        cooldownMs: 2_000,
      },
      { now: () => now, random: () => 0, sleep },
    );

    await expect(
      retrying.fetchDailyPrices("AAPL", "2026-11-19", "2026-11-20"),
    ).rejects.toBeInstanceOf(PriceProviderUnavailableError);
    await expect(
      retrying.fetchDailyPrices("AAPL", "2026-11-19", "2026-11-20"),
    ).rejects.toBeInstanceOf(PriceProviderUnavailableError);
    const callsBeforeCooldown = vi.mocked(provider.fetchDailyPrices).mock.calls.length;
    await expect(
      retrying.fetchDailyPrices("AAPL", "2026-11-19", "2026-11-20"),
    ).rejects.toBeInstanceOf(PriceProviderCooldownError);

    expect(provider.fetchDailyPrices).toHaveBeenCalledTimes(callsBeforeCooldown);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 50);
  });

  it("rejects garbage provider output through the Zod contract", async () => {
    const provider: PriceProvider = {
      fetchDailyPrices: async () => [{ ticker: "AAPL", close: "not-a-price" }],
      fetchTickerMetadata: async () => ({}),
    };
    const retrying = new RetryingPriceProvider(
      provider,
      { attempts: 1, failureThreshold: 1, cooldownMs: 1 },
      { now: () => 100, sleep: async () => undefined, random: () => 0 },
    );

    await expect(
      retrying.fetchDailyPrices("AAPL", "2026-11-19", "2026-11-20"),
    ).rejects.toBeInstanceOf(PriceProviderUnavailableError);
  });
});
