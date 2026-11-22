import { describe, expect, it } from "vitest";
import { HoldingCreateSchema, HoldingImportRowSchema, HoldingUpdateSchema } from "./holdings.js";

describe("holding input schemas", () => {
  it("normalizes a valid holding and its tags", () => {
    expect(
      HoldingCreateSchema.parse({
        ticker: " aapl ",
        shares: "+5.125",
        avg_cost: "150.25000000",
        tags: [" Growth ", "income", "growth", ""],
      }),
    ).toEqual({
      ticker: "AAPL",
      shares: "5.125",
      avg_cost: "150.25",
      tags: ["growth", "income"],
    });
  });

  it("accepts numeric database precision boundaries without rounding", () => {
    expect(
      HoldingCreateSchema.parse({
        ticker: "BRK.B",
        shares: "9999999999999999.123456789012",
        avg_cost: "999999999999.12345678",
      }),
    ).toMatchObject({ shares: "9999999999999999.123456789012", avg_cost: "999999999999.12345678" });
  });

  it.each([
    ["scientific notation", "1e3", "1"],
    ["NaN", "NaN", "1"],
    ["Infinity", "Infinity", "1"],
    ["zero shares", "0", "1"],
    ["negative shares", "-1", "1"],
    ["excess share precision", "1.0000000000001", "1"],
    ["share overflow", "10000000000000000", "1"],
    ["negative average cost", "1", "-0.01"],
    ["excess cost precision", "1", "1.000000001"],
    ["cost overflow", "1", "1000000000000"],
  ])("rejects %s", (_case, shares, avg_cost) => {
    expect(() => HoldingCreateSchema.parse({ ticker: "AAPL", shares, avg_cost })).toThrow();
  });

  it("rejects non-USD import currency and defaults an omitted currency to USD", () => {
    expect(
      HoldingImportRowSchema.parse({
        ticker: "aapl",
        shares: "+5",
        avg_cost: "1.5",
        tags: "growth; value",
      }),
    ).toMatchObject({
      ticker: "AAPL",
      shares: "5",
      avg_cost: "1.5",
      currency: "USD",
      tags: ["growth", "value"],
    });
    expect(() =>
      HoldingImportRowSchema.parse({ ticker: "AAPL", shares: "1", avg_cost: "1", currency: "EUR" }),
    ).toThrow();
  });

  it("limits and deduplicates normalized tags", () => {
    expect(
      HoldingCreateSchema.parse({
        ticker: "AAPL",
        shares: "1",
        avg_cost: "0",
        tags: Array.from({ length: 10 }, (_, index) => `tag${index}`),
      }),
    ).toMatchObject({ tags: Array.from({ length: 10 }, (_, index) => `tag${index}`) });
    expect(() =>
      HoldingCreateSchema.parse({
        ticker: "AAPL",
        shares: "1",
        avg_cost: "0",
        tags: Array.from({ length: 11 }, (_, index) => `tag${index}`),
      }),
    ).toThrow();
    expect(() =>
      HoldingCreateSchema.parse({
        ticker: "AAPL",
        shares: "1",
        avg_cost: "0",
        tags: ["a".repeat(33)],
      }),
    ).toThrow();
  });

  it("allows edits only to shares, avg_cost, and tags", () => {
    expect(HoldingUpdateSchema.parse({ shares: "2", avg_cost: "15", tags: ["growth"] })).toEqual({
      shares: "2",
      avg_cost: "15",
      tags: ["growth"],
    });
    expect(() => HoldingUpdateSchema.parse({ ticker: "MSFT" })).toThrow();
    expect(() => HoldingUpdateSchema.parse({ user_id: "other-user" })).toThrow();
  });
});
