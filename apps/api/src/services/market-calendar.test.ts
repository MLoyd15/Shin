import { describe, expect, it } from "vitest";
import {
  fetchedAfterMarketClose,
  isTradingDate,
  latestCompletedTradingDate,
  previousTradingDate,
} from "./market-calendar.js";

describe("NYSE trading calendar", () => {
  it("excludes weekends, Thanksgiving, and Good Friday", () => {
    expect(isTradingDate("2026-11-21")).toBe(false);
    expect(isTradingDate("2026-11-26")).toBe(false);
    expect(isTradingDate("2026-04-03")).toBe(false);
    expect(isTradingDate("2026-11-25")).toBe(true);
  });

  it("finds the previous trading date across Thanksgiving", () => {
    expect(previousTradingDate("2026-11-27")).toBe("2026-11-25");
  });

  it("uses the last completed New York session, not calendar yesterday", () => {
    expect(latestCompletedTradingDate(new Date("2026-11-27T15:00:00.000Z"))).toBe("2026-11-25");
    expect(latestCompletedTradingDate(new Date("2026-11-27T22:00:00.000Z"))).toBe("2026-11-27");
  });

  it("marks data fetched before the expected market close as stale", () => {
    expect(fetchedAfterMarketClose("2026-11-20T20:59:00.000Z", "2026-11-20")).toBe(false);
    expect(fetchedAfterMarketClose("2026-11-20T21:00:00.000Z", "2026-11-20")).toBe(true);
  });
});
