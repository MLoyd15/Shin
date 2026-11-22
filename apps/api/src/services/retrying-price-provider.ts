import {
  PriceBarListSchema,
  TickerMetadataSchema,
  type PriceProvider,
} from "../providers/price-provider.js";

export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  failureThreshold: number;
  cooldownMs: number;
}

export interface RetryRuntime {
  now: () => number;
  random: () => number;
  sleep: (milliseconds: number) => Promise<void>;
}

export class PriceProviderCooldownError extends Error {
  constructor(
    readonly symbol: string,
    readonly retryAt: number,
  ) {
    super(`Price provider is cooling down for ${symbol}`);
    this.name = "PriceProviderCooldownError";
  }
}

export class PriceProviderUnavailableError extends Error {
  constructor(
    readonly symbol: string,
    options?: ErrorOptions,
  ) {
    super(`Price provider is unavailable for ${symbol}`, options);
    this.name = "PriceProviderUnavailableError";
  }
}

const defaultPolicy: RetryPolicy = {
  attempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
  failureThreshold: 3,
  cooldownMs: 30_000,
};

const defaultRuntime: RetryRuntime = {
  now: Date.now,
  random: Math.random,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

export class RetryingPriceProvider implements PriceProvider {
  private readonly failures = new Map<string, { count: number; retryAt: number }>();
  private readonly policy: RetryPolicy;
  private readonly runtime: RetryRuntime;

  constructor(
    private readonly provider: PriceProvider,
    policy: Partial<RetryPolicy> = {},
    runtime: Partial<RetryRuntime> = {},
  ) {
    this.policy = { ...defaultPolicy, ...policy };
    this.runtime = { ...defaultRuntime, ...runtime };
    if (
      this.policy.attempts < 1 ||
      this.policy.failureThreshold < 1 ||
      this.policy.baseDelayMs < 0 ||
      this.policy.maxDelayMs < 0 ||
      this.policy.cooldownMs < 1
    ) {
      throw new Error("Invalid price provider retry policy");
    }
  }

  async fetchDailyPrices(symbol: string, fromDate: string, throughDate: string): Promise<unknown> {
    return this.run(symbol, async () =>
      PriceBarListSchema.parse(await this.provider.fetchDailyPrices(symbol, fromDate, throughDate)),
    );
  }

  async fetchTickerMetadata(symbol: string): Promise<unknown> {
    return this.run(symbol, async () =>
      TickerMetadataSchema.parse(await this.provider.fetchTickerMetadata(symbol)),
    );
  }

  private async run<T>(symbol: string, operation: () => Promise<T>): Promise<T> {
    const state = this.failures.get(symbol);
    if (state && state.retryAt > this.runtime.now()) {
      throw new PriceProviderCooldownError(symbol, state.retryAt);
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.policy.attempts; attempt += 1) {
      try {
        const result = await operation();
        this.failures.delete(symbol);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < this.policy.attempts) {
          const exponentialDelay = this.policy.baseDelayMs * 2 ** (attempt - 1);
          const jitteredDelay = exponentialDelay * (0.5 + this.runtime.random());
          await this.runtime.sleep(Math.min(jitteredDelay, this.policy.maxDelayMs));
        }
      }
    }

    const failedRequests = (state?.count ?? 0) + 1;
    if (failedRequests >= this.policy.failureThreshold) {
      this.failures.set(symbol, {
        count: failedRequests,
        retryAt: this.runtime.now() + this.policy.cooldownMs,
      });
    } else {
      this.failures.set(symbol, { count: failedRequests, retryAt: 0 });
    }
    throw new PriceProviderUnavailableError(symbol, { cause: lastError });
  }
}
