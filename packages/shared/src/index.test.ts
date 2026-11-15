import { describe, expect, it } from "vitest";
import { formatCompact, formatCurrency, formatDate, formatPercent } from "./format.js";

describe("formatCurrency", () => {
  it("formats decimal strings as USD without losing cents", () => {
    expect(formatCurrency("1234.5")).toBe("$1,234.50");
  });

  it("formats negative values with a visible minus sign", () => {
    expect(formatCurrency("-12.34")).toBe("-$12.34");
  });
});

describe("formatPercent", () => {
  it("formats percentage values consistently", () => {
    expect(formatPercent("0.125")).toBe("12.50%");
  });
});

describe("formatCompact", () => {
  it("formats large decimal strings compactly", () => {
    expect(formatCompact("1250000")).toBe("1.3M");
  });
});

describe("formatDate", () => {
  it("formats a date without depending on the host timezone", () => {
    expect(formatDate("2025-06-15")).toBe("Jun 15, 2025");
  });
});
