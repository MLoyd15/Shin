import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createHoldingsRouter } from "./holdings.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const seen: Array<{ path: string; method: string; userId: string | null; ticker: string | null; authorization: string | null }> = [];
const supabaseFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.pathname === "/auth/v1/user") return Response.json({ id: ownerA, aud: "authenticated", role: "authenticated", email: "a@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00.000Z" });
  seen.push({ path: url.pathname, method: request.method, userId: url.searchParams.get("user_id"), ticker: url.searchParams.get("ticker"), authorization: request.headers.get("authorization") });
  if (url.pathname === "/rest/v1/holdings") return Response.json([]);
  return Response.json({ message: "not found" }, { status: 404 });
};

describe("holdings HTTP isolation", () => {
  const app = createApp({ apiRouter: createHoldingsRouter(), auth: { supabaseUrl: "http://supabase.test", supabaseAnonKey: "test-key", fetch: supabaseFetch } });
  let server: ReturnType<typeof app.listen>;
  let baseUrl = "";

  beforeAll(async () => {
    process.env["HOLDINGS_IMPORT_SECRET"] = "test-import-secret-with-at-least-32-characters";
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  it("scopes list, update, and delete to the JWT user and hides another user's row as 404", async () => {
    const list = await fetch(`${baseUrl}/api/holdings`, { headers: { Authorization: "Bearer user-a-token" } });
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([]);
    const update = await fetch(`${baseUrl}/api/holdings/OTHER`, { method: "PATCH", headers: { Authorization: "Bearer user-a-token", "Content-Type": "application/json" }, body: JSON.stringify({ shares: "2" }) });
    expect(update.status).toBe(404);
    const remove = await fetch(`${baseUrl}/api/holdings/OTHER`, { method: "DELETE", headers: { Authorization: "Bearer user-a-token" } });
    expect(remove.status).toBe(404);
    expect(seen).toHaveLength(3);
    expect(seen.every((call) => call.userId === `eq.${ownerA}`)).toBe(true);
    expect(seen.every((call) => call.authorization === "Bearer user-a-token")).toBe(true);
    expect(seen.slice(1).every((call) => call.ticker === "eq.OTHER")).toBe(true);
  });

  it("rejects CSV requests larger than 1 MiB with a clear 413", async () => {
    const response = await fetch(`${baseUrl}/api/holdings/import/preview`, {
      method: "POST",
      headers: { Authorization: "Bearer user-a-token", "Content-Type": "text/csv" },
      body: `ticker,shares,avg_cost\n${"x".repeat(1_048_576)}`,
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/1 MiB/i) });
  });
});
