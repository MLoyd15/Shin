import { describe, expect, it } from "vitest";
import {
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  createHoldingsCsvTemplate,
  parseHoldingsCsv,
} from "./holdings-csv.js";

describe("holdings CSV parser", () => {
  it("parses quoted commas and escaped quotes", () => {
    const [row] = parseHoldingsCsv(
      'ticker,shares,avg_cost,tags\r\nAAPL,5,10,"quality, say ""yes"""',
    );
    expect(row).toMatchObject({
      rowNumber: 2,
      values: { ticker: "AAPL", shares: "5", avg_cost: "10", tags: 'quality, say "yes"' },
      errors: [],
    });
  });

  it("preserves newlines inside quoted cells", () => {
    const [row] = parseHoldingsCsv('ticker,shares,avg_cost,tags\nAAPL,5,10,"growth\nincome"');
    expect(row?.values["tags"]).toBe("growth\nincome");
    expect(row?.rowNumber).toBe(2);
  });

  it("strips a BOM and parses CRLF line endings", () => {
    const rows = parseHoldingsCsv("\uFEFFticker,shares,avg_cost\r\nAAPL,5,10\r\nMSFT,2,20");
    expect(rows.map((row) => row.values["ticker"])).toEqual(["AAPL", "MSFT"]);
    expect(rows.map((row) => row.rowNumber)).toEqual([2, 3]);
  });

  it("skips empty lines and preserves source row numbers", () => {
    const rows = parseHoldingsCsv("ticker,shares,avg_cost\n\nAAPL,5,10\n   \nMSFT,2,20");
    expect(rows.map((row) => row.rowNumber)).toEqual([3, 5]);
  });

  it("rejects a missing header and malformed quoting", () => {
    expect(() => parseHoldingsCsv("\n  \n")).toThrow(/header/i);
    expect(() => parseHoldingsCsv('ticker,shares,avg_cost\nAAPL,5,"10')).toThrow(/quote/i);
  });

  it("marks extra columns as a row error without dropping other rows", () => {
    const rows = parseHoldingsCsv("ticker,shares,avg_cost\nAAPL,5,10\nMSFT,2,20,unexpected");
    expect(rows[0]?.errors).toEqual([]);
    expect(rows[1]?.errors).toEqual([{ field: "row", reason: "Row contains extra columns" }]);
  });

  it("neutralizes formula-like text cells but leaves numeric text for validation", () => {
    const [row] = parseHoldingsCsv("ticker,shares,avg_cost,tags\n=A1,+5,-1.5,@SUM(A1:A2)");
    expect(row?.values).toEqual({
      ticker: "'=A1",
      shares: "+5",
      avg_cost: "-1.5",
      currency: "",
      tags: "'@SUM(A1:A2)",
    });
  });

  it("rejects files over 1 MiB with a 413 error", () => {
    expect(CSV_MAX_BYTES).toBe(1_048_576);
    expect(() => parseHoldingsCsv(`ticker,shares,avg_cost\n${"x".repeat(CSV_MAX_BYTES)}`)).toThrow(
      /1 MiB/i,
    );
  });

  it("accepts 500 data rows and rejects row 501", () => {
    expect(CSV_MAX_ROWS).toBe(500);
    const header = "ticker,shares,avg_cost";
    expect(
      parseHoldingsCsv(
        [header, ...Array.from({ length: CSV_MAX_ROWS }, () => "AAPL,1,1")].join("\n"),
      ),
    ).toHaveLength(500);
    expect(() =>
      parseHoldingsCsv(
        [header, ...Array.from({ length: CSV_MAX_ROWS + 1 }, () => "AAPL,1,1")].join("\n"),
      ),
    ).toThrow(/500 rows/i);
  });

  it("generates a header-only template without formula cells", () => {
    const template = createHoldingsCsvTemplate();
    expect(template).toBe("ticker,shares,avg_cost,currency,tags\r\n");
    expect(template.split(",").every((cell) => !/^[=+\-@]/.test(cell))).toBe(true);
  });
});
