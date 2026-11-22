import { PricesRepository, type PriceCacheWrite } from "../repositories/prices.js";
import { getServiceRoleClient } from "./service-role-client.js";

export async function writePriceCacheRows(rows: readonly PriceCacheWrite[]): Promise<void> {
  await new PricesRepository(getServiceRoleClient()).upsertPrices(rows);
}
