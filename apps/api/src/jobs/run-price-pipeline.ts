import { pathToFileURL } from "node:url";
import pino, { type Logger } from "pino";
import { HoldingTickerSchema } from "@folioagent/shared";
import {
  PriceBarListSchema,
  TickerMetadataSchema,
  type PriceProvider,
} from "../providers/price-provider.js";
import { YahooFinancePriceProvider } from "../providers/yahoo-finance.js";
import {
  PricesRepository,
  PricesRepositoryError,
  toPriceCacheWrites,
} from "../repositories/prices.js";
import { addCalendarDays, latestCompletedTradingDate } from "../services/market-calendar.js";
import { RetryingPriceProvider } from "../services/retrying-price-provider.js";
import { getServiceRoleClient } from "./service-role-client.js";

const logger = pino({ name: "price-pipeline" });
const lookbackDays = 30;

export interface PricePipelineRepository {
  upsertPrices(rows: ReturnType<typeof toPriceCacheWrites>): Promise<void>;
}

export async function runPricePipeline(
  requestedTickers: readonly string[],
  dependencies: {
    repository: PricePipelineRepository;
    upsertTicker(
      metadata: ReturnType<typeof TickerMetadataSchema.parse>,
      validatedAt: string,
    ): Promise<void>;
    provider: PriceProvider;
    now?: () => Date;
    log?: Pick<Logger, "info">;
  },
): Promise<void> {
  const now = dependencies.now ?? (() => new Date());
  const log = dependencies.log ?? logger;
  const tickers = [
    ...new Set(requestedTickers.map((ticker) => HoldingTickerSchema.parse(ticker))),
  ].sort();
  if (!tickers.length) {
    log.info("No tickers found; price pipeline has nothing to sync");
    return;
  }

  const runAt = now();
  const asOf = latestCompletedTradingDate(runAt);
  const fromDate = addCalendarDays(asOf, -lookbackDays);
  for (const ticker of tickers) {
    const metadata = TickerMetadataSchema.parse(
      await dependencies.provider.fetchTickerMetadata(ticker),
    );
    if (metadata.symbol !== ticker)
      throw new Error(`Metadata provider returned ${metadata.symbol} for ${ticker}`);
    await dependencies.upsertTicker(metadata, runAt.toISOString());
    log.info(
      { ticker, name: metadata.name, sector: metadata.sector, industry: metadata.industry },
      "Upserted ticker metadata from provider",
    );

    const prices = PriceBarListSchema.parse(
      await dependencies.provider.fetchDailyPrices(ticker, fromDate, asOf),
    );
    if (prices.some((row) => row.ticker !== ticker)) {
      throw new Error(`Price provider returned a different ticker for ${ticker}`);
    }
    const inRangePrices = prices.filter((row) => row.date >= fromDate && row.date <= asOf);
    if (!inRangePrices.length) throw new Error(`No end-of-day prices were returned for ${ticker}`);
    const uniqueDates = new Set(inRangePrices.map((row) => row.date));
    if (uniqueDates.size !== inRangePrices.length) {
      throw new Error(`Price provider returned duplicate ${ticker} trading dates`);
    }
    await dependencies.repository.upsertPrices(
      toPriceCacheWrites(inRangePrices, now().toISOString()),
    );
    log.info({ ticker, rows: inRangePrices.length, asOf }, "Upserted end-of-day prices");
  }
}

async function main(): Promise<void> {
  const client = getServiceRoleClient();
  const repository = new PricesRepository(client);
  const rawTickers = process.argv.slice(2);
  const tickers = rawTickers.length ? rawTickers : await repository.listHeldTickers();
  await runPricePipeline(tickers, {
    repository,
    upsertTicker: async (metadata, validatedAt) => {
      const result = await client
        .from("tickers")
        .upsert({ ...metadata, last_validated_at: validatedAt }, { onConflict: "symbol" });
      if (result.error) throw new PricesRepositoryError(result.error.code, result.error.message);
    },
    provider: new RetryingPriceProvider(new YahooFinancePriceProvider()),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    logger.error({ err: error }, "Price pipeline failed");
    process.exitCode = 1;
  });
}
