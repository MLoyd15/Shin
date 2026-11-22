import { describe, expect, it, vi } from "vitest";
import {
  HoldingsService,
  HoldingsServiceError,
  type HoldingsRepositoryPort,
  type StoredHolding,
} from "./holdings.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ticker = (symbol: string) => ({ symbol, name: `${symbol} Inc.`, sector: "Technology", industry: null, currency: "USD" });

function makeRepository(overrides: Partial<HoldingsRepositoryPort> = {}) {
  const state = {
    tickers: new Set(["AAA", "BBB", "CCC"]),
    existing: new Set<string>(),
    insertMany: vi.fn(async (rows: readonly Omit<StoredHolding, "user_id">[]) =>
      rows.map((row) => ({ ...row, user_id: ownerA }))),
  };
  const repository: HoldingsRepositoryPort = {
    list: async () => [],
    findTicker: async (symbol) => (state.tickers.has(symbol) ? ticker(symbol) : null),
    findTickers: async (symbols) => symbols.flatMap((symbol) => (state.tickers.has(symbol) ? [ticker(symbol)] : [])),
    findExistingTickers: async (symbols) => symbols.filter((symbol) => state.existing.has(symbol)),
    create: async (row) => ({ ...row, user_id: ownerA }),
    update: async (_symbol, row) => ({
      ticker: "AAA",
      shares: "2",
      avg_cost: "1",
      tags: [],
      user_id: ownerA,
      ...row,
    }),
    delete: async () => true,
    insertMany: state.insertMany,
    ...overrides,
  };
  return { repository, state };
}

describe("holdings service", () => {
  it("normalizes ticker input and rejects unknown symbols", async () => {
    const { repository } = makeRepository();
    const service = new HoldingsService(repository, ownerA, "preview-secret-at-least-32-characters");
    await expect(
      service.create({ ticker: " aaa ", shares: "2", avg_cost: "1", tags: [] }),
    ).resolves.toMatchObject({ ticker: "AAA", user_id: ownerA });
    await expect(
      service.create({ ticker: "ZZZ", shares: "2", avg_cost: "1", tags: [] }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("returns conflict for a duplicate create and hides another user's update/delete as 404", async () => {
    const { repository } = makeRepository({
      create: async () => {
        throw { code: "23505" };
      },
      update: async () => null,
      delete: async () => false,
    });
    const service = new HoldingsService(repository, ownerA, "preview-secret-at-least-32-characters");
    await expect(
      service.create({ ticker: "AAA", shares: "2", avg_cost: "1", tags: [] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(service.update("BBB", { shares: "2" })).rejects.toMatchObject({ status: 404 });
    await expect(service.delete("BBB")).rejects.toMatchObject({ status: 404 });
  });

  it("previews duplicates and unknown tickers as skipped rows without blocking valid rows", async () => {
    const { repository } = makeRepository();
    const service = new HoldingsService(repository, ownerA, "preview-secret-at-least-32-characters");
    const preview = await service.previewCsv(
      "ticker,shares,avg_cost\nAAA,1,10\nAAA,2,20\nZZZ,1,5\nBBB,-1,10\nCCC,3,4",
    );
    expect(preview.willImport).toBe(1);
    expect(preview.skipped).toBe(4);
    expect(preview.rows.filter((row) => row.status === "valid").map((row) => row.values["ticker"])).toEqual([
      "CCC",
    ]);
    expect(preview.rows.find((row) => row.values["ticker"] === "ZZZ")?.errors[0]?.reason).toMatch(
      /unknown ticker/i,
    );
    expect(preview.rows.filter((row) => row.values["ticker"] === "AAA").every((row) => row.status === "skipped")).toBe(
      true,
    );
  });

  it("revalidates the raw CSV and returns conflict with no insert if a holding appears after preview", async () => {
    const { repository, state } = makeRepository();
    const service = new HoldingsService(repository, ownerA, "preview-secret-at-least-32-characters");
    const csv = "ticker,shares,avg_cost\nAAA,1,10";
    const preview = await service.previewCsv(csv);
    state.existing.add("AAA");
    await expect(service.confirmCsv(csv, preview.previewToken)).rejects.toMatchObject({ status: 409 });
    expect(state.insertMany).not.toHaveBeenCalled();
  });

  it("returns a conflict if a duplicate races with the atomic bulk insert", async () => {
    const insertMany = vi.fn(async () => {
      throw { code: "23505" };
    });
    const { repository } = makeRepository({ insertMany });
    const service = new HoldingsService(repository, ownerA, "preview-secret-at-least-32-characters");
    const csv = "ticker,shares,avg_cost\nAAA,1,10\nBBB,2,20";
    const preview = await service.previewCsv(csv);

    await expect(service.confirmCsv(csv, preview.previewToken)).rejects.toMatchObject({
      status: 409,
      message: "A duplicate holding appeared; no rows were imported",
    });
    expect(insertMany).toHaveBeenCalledTimes(1);
    expect(insertMany).toHaveBeenCalledWith([
      { ticker: "AAA", shares: "1", avg_cost: "10", tags: [] },
      { ticker: "BBB", shares: "2", avg_cost: "20", tags: [] },
    ]);
  });

  it("inserts only revalidated eligible rows with one bulk repository call", async () => {
    const { repository, state } = makeRepository();
    const service = new HoldingsService(repository, ownerA, "preview-secret-at-least-32-characters");
    const csv = "ticker,shares,avg_cost,currency,tags\nAAA,+5,10,USD,growth; Growth\nZZZ,1,5,USD,unknown";
    const preview = await service.previewCsv(csv);
    const result = await service.confirmCsv(csv, preview.previewToken);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(state.insertMany).toHaveBeenCalledTimes(1);
    expect(state.insertMany).toHaveBeenCalledWith([
      { ticker: "AAA", shares: "5", avg_cost: "10", tags: ["growth"] },
    ]);
  });

  it("rejects tampered preview tokens and CSV content", async () => {
    const { repository } = makeRepository();
    const service = new HoldingsService(repository, ownerA, "preview-secret-at-least-32-characters");
    const csv = "ticker,shares,avg_cost\nAAA,1,10";
    const preview = await service.previewCsv(csv);
    await expect(service.confirmCsv(`${csv}\nBBB,2,5`, preview.previewToken)).rejects.toBeInstanceOf(
      HoldingsServiceError,
    );
    await expect(service.confirmCsv(csv, `${preview.previewToken}x`)).rejects.toMatchObject({ status: 409 });
  });
});
