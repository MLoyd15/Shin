import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { HoldingsRepository, HoldingsRepositoryError } from "./holdings.js";

const ownerA = "00000000-0000-4000-8000-000000000001";

function createRepository(fetchImplementation: typeof fetch, userId = ownerA) {
  const client = createClient("http://supabase.test", "test-anon-key", {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: "Bearer user-a-jwt" },
      fetch: fetchImplementation,
    },
  });
  return new HoldingsRepository(client, userId);
}

describe("holdings repository", () => {
  it("lists holdings scoped to the authenticated user and adds ticker metadata", async () => {
    const observed: Request[] = [];
    const repository = createRepository(async (input, init) => {
      const request = new Request(input, init);
      observed.push(request);
      if (new URL(request.url).pathname.endsWith("/holdings")) {
        return Response.json([
          { ticker: "AAA", user_id: ownerA, shares: "2", avg_cost: "10", tags: [] },
        ]);
      }
      return Response.json([
        {
          symbol: "AAA",
          name: "AAA Inc.",
          sector: "Technology",
          industry: null,
          currency: "USD",
        },
      ]);
    });
    const rows = await repository.list();
    const holdingsUrl = new URL(observed[0]!.url);
    expect(rows[0]).toMatchObject({ ticker: "AAA", name: "AAA Inc.", sector: "Technology" });
    expect(holdingsUrl.searchParams.get("user_id")).toBe(`eq.${ownerA}`);
    expect(observed).toHaveLength(2);
    expect(
      observed.every((request) => request.headers.get("authorization") === "Bearer user-a-jwt"),
    ).toBe(true);
  });

  it("adds user_id from the repository context on create and bulk import", async () => {
    const observed: Request[] = [];
    const repository = createRepository(async (input, init) => {
      const request = new Request(input, init);
      observed.push(new Request(input, init));
      return Response.json(await request.json());
    });
    await repository.create({ ticker: "AAA", shares: "2", avg_cost: "10", tags: [] });
    await repository.insertMany([
      { ticker: "BBB", shares: "1", avg_cost: "5", tags: [] },
      { ticker: "CCC", shares: "3", avg_cost: "2", tags: ["growth"] },
    ]);
    expect(observed).toHaveLength(2);
    expect(await observed[0]!.clone().json()).toMatchObject({ user_id: ownerA, ticker: "AAA" });
    expect(await observed[1]!.clone().json()).toEqual([
      { user_id: ownerA, ticker: "BBB", shares: "1", avg_cost: "5", tags: [] },
      { user_id: ownerA, ticker: "CCC", shares: "3", avg_cost: "2", tags: ["growth"] },
    ]);
    expect(observed[1]!.method).toBe("POST");
  });

  it("scopes update and delete to the authenticated user so another user's row is absent", async () => {
    const observed: Request[] = [];
    const repository = createRepository(async (input, init) => {
      observed.push(new Request(input, init));
      return Response.json([]);
    });
    await expect(repository.update("BBB", { shares: "5" })).resolves.toBeNull();
    await expect(repository.delete("BBB")).resolves.toBe(false);
    for (const request of observed) {
      const url = new URL(request.url);
      expect(url.searchParams.get("user_id")).toBe(`eq.${ownerA}`);
      expect(url.searchParams.get("ticker")).toBe("eq.BBB");
      expect(request.headers.get("authorization")).toBe("Bearer user-a-jwt");
    }
  });

  it("reads tickers but never writes the shared ticker table", async () => {
    const observed: Request[] = [];
    const repository = createRepository(async (input, init) => {
      const request = new Request(input, init);
      observed.push(request);
      return Response.json([{ symbol: "AAA", name: "AAA Inc.", currency: "USD" }]);
    });
    await expect(repository.findTicker("AAA")).resolves.toMatchObject({ symbol: "AAA" });
    await expect(repository.findTickers(["AAA"])).resolves.toHaveLength(1);
    expect(observed.every((request) => new URL(request.url).pathname.endsWith("/tickers"))).toBe(
      true,
    );
    expect(observed.every((request) => request.method === "GET")).toBe(true);
  });

  it("preserves unique-constraint errors for service conflict handling", async () => {
    const repository = createRepository(async () =>
      Response.json({ code: "23505", message: "duplicate" }, { status: 409 }),
    );
    await expect(
      repository.insertMany([{ ticker: "AAA", shares: "1", avg_cost: "1", tags: [] }]),
    ).rejects.toBeInstanceOf(HoldingsRepositoryError);
  });
});
