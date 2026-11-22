import { Router, type NextFunction, type Request, type Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HoldingTickerSchema } from "@folioagent/shared";
import type { PriceProvider } from "../providers/price-provider.js";
import { PricesRepository } from "../repositories/prices.js";
import {
  PricesService,
  PricesServiceError,
  type PriceCacheWriter,
  type PricesServiceOptions,
} from "../services/prices.js";

export interface PricesRouterOptions {
  provider: PriceProvider;
  writeCache?: PriceCacheWriter;
  now?: PricesServiceOptions["now"];
}

function sendError(error: unknown, response: Response, next: NextFunction): void {
  if (error instanceof PricesServiceError) {
    response.status(error.status).json({ error: error.message });
  } else {
    next(error);
  }
}

function getClient(request: Request): SupabaseClient {
  if (!request.user || !request.supabase) throw new PricesServiceError(401, "Unauthorized");
  return request.supabase;
}

export function createPricesRouter(options: PricesRouterOptions): Router {
  const router = Router();

  router.get("/prices", async (request, response, next) => {
    try {
      const client = getClient(request);
      const result = await client.from("holdings").select("ticker").order("ticker");
      if (result.error) throw result.error;
      const tickers = (result.data ?? []).map((row) => HoldingTickerSchema.parse(row.ticker));
      const prices = await new PricesService(new PricesRepository(client), options.provider, {
        ...(options.now ? { now: options.now } : {}),
        ...(options.writeCache ? { writeCache: options.writeCache } : {}),
      }).getForTickers(tickers);
      response.json({ prices });
    } catch (error) {
      sendError(error, response, next);
    }
  });

  return router;
}
