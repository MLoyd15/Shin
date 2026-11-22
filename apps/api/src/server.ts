import { Router } from "express";
import { createApp } from "./app.js";
import { createHoldingsRouter } from "./routes/holdings.js";
import { createPricesRouter } from "./routes/prices.js";
import { YahooFinancePriceProvider } from "./providers/yahoo-finance.js";
import { RetryingPriceProvider } from "./services/retrying-price-provider.js";
import { writePriceCacheRows } from "./jobs/price-cache-writer.js";

const configuredPort = Number.parseInt(process.env["PORT"] ?? "4000", 10);
const port = Number.isNaN(configuredPort) ? 4000 : configuredPort;

const supabaseUrl = process.env["SUPABASE_URL"];
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"];
if (!supabaseUrl || !supabaseAnonKey)
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required to start the API");

const apiRouter = Router();
apiRouter.use(createHoldingsRouter());
apiRouter.use(
  createPricesRouter({
    provider: new RetryingPriceProvider(new YahooFinancePriceProvider()),
    writeCache: writePriceCacheRows,
  }),
);

createApp({ apiRouter, auth: { supabaseUrl, supabaseAnonKey } }).listen(port, () => {
  process.stdout.write(`FolioAgent API listening on port ${port}\n`);
});
