export const CSV_MAX_BYTES = 1_048_576;
export const CSV_MAX_ROWS = 500;

const requiredHeaders = ["ticker", "shares", "avg_cost"] as const;
const allowedHeaders = new Set([...requiredHeaders, "currency", "tags"]);
const formulaTextHeaders = new Set(["ticker", "currency", "tags"]);

export interface CsvRowError {
  field: string;
  reason: string;
}

export interface ParsedHoldingCsvRow {
  rowNumber: number;
  values: Record<string, string>;
  errors: CsvRowError[];
}

interface CsvRecord {
  rowNumber: number;
  cells: string[];
}

export class HoldingsCsvError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "HoldingsCsvError";
  }
}

function neutralizeFormulaText(value: string): string {
  const trimmed = value.trimStart();
  if (/^[=+\-@]/.test(trimmed)) return `'${trimmed}`;
  return value;
}

function parseRecords(csv: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;
  let recordHasStructure = false;
  let physicalLine = 1;
  let recordStartLine = 1;

  const endRecord = () => {
    const emptyLine = cells.length === 0 && !recordHasStructure && field.trim() === "";
    if (!emptyLine) records.push({ rowNumber: recordStartLine, cells: [...cells, field] });
    cells = [];
    field = "";
    inQuotes = false;
    afterQuote = false;
    recordHasStructure = false;
    recordStartLine = physicalLine;
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;

    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        field += character;
        if (character === "\r") {
          if (csv[index + 1] === "\n") {
            field += "\n";
            index += 1;
          }
          physicalLine += 1;
        } else if (character === "\n") {
          physicalLine += 1;
        }
      }
      continue;
    }

    if (afterQuote) {
      if (character === ",") {
        cells.push(field);
        field = "";
        afterQuote = false;
        recordHasStructure = true;
        continue;
      }
      if (character === "\n" || character === "\r") {
        if (character === "\r" && csv[index + 1] !== "\n") {
          throw new HoldingsCsvError(`Malformed CSV near row ${recordStartLine}: expected CRLF`);
        }
        if (character === "\r") index += 1;
        physicalLine += 1;
        endRecord();
        continue;
      }
      throw new HoldingsCsvError(
        `Malformed CSV near row ${recordStartLine}: unexpected text after a quote`,
      );
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new HoldingsCsvError(
          `Malformed CSV near row ${recordStartLine}: quote inside an unquoted cell`,
        );
      }
      inQuotes = true;
      recordHasStructure = true;
      continue;
    }
    if (character === ",") {
      cells.push(field);
      field = "";
      recordHasStructure = true;
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && csv[index + 1] !== "\n") {
        throw new HoldingsCsvError(`Malformed CSV near row ${recordStartLine}: expected CRLF`);
      }
      if (character === "\r") index += 1;
      physicalLine += 1;
      endRecord();
      continue;
    }
    field += character;
  }

  if (inQuotes) {
    throw new HoldingsCsvError(
      `Malformed CSV near row ${recordStartLine}: quoted cell is not closed`,
    );
  }
  if (cells.length > 0 || field.length > 0 || recordHasStructure || afterQuote) endRecord();
  return records;
}

function parseHeaders(record: CsvRecord): string[] {
  const headers = record.cells.map((cell) => cell.trim().toLowerCase());
  if (headers.length === 0 || headers.every((header) => header === "")) {
    throw new HoldingsCsvError("CSV header is required");
  }
  if (new Set(headers).size !== headers.length) {
    throw new HoldingsCsvError("CSV header contains duplicate columns");
  }
  if (headers.some((header) => !allowedHeaders.has(header))) {
    throw new HoldingsCsvError("CSV contains an unsupported column");
  }
  if (!requiredHeaders.every((header) => headers.includes(header))) {
    throw new HoldingsCsvError("CSV must include ticker, shares, and avg_cost columns");
  }
  return headers;
}

export function parseHoldingsCsv(csv: string): ParsedHoldingCsvRow[] {
  if (Buffer.byteLength(csv, "utf8") > CSV_MAX_BYTES) {
    throw new HoldingsCsvError("CSV exceeds the 1 MiB file size limit", 413);
  }

  const withoutBom = csv.startsWith("\uFEFF") ? csv.slice(1) : csv;
  const records = parseRecords(withoutBom);
  if (records.length === 0) throw new HoldingsCsvError("CSV header is required");

  const [headerRecord, ...dataRecords] = records;
  const headers = parseHeaders(headerRecord!);
  if (dataRecords.length > CSV_MAX_ROWS) {
    throw new HoldingsCsvError(`CSV exceeds the limit of ${CSV_MAX_ROWS} rows`, 413);
  }

  return dataRecords.map((record) => {
    const errors: CsvRowError[] = [];
    if (record.cells.length > headers.length) {
      errors.push({ field: "row", reason: "Row contains extra columns" });
    }

    const values: Record<string, string> = {
      ticker: "",
      shares: "",
      avg_cost: "",
      currency: "",
      tags: "",
    };
    headers.forEach((header, index) => {
      const cell = record.cells[index] ?? "";
      values[header] = formulaTextHeaders.has(header) ? neutralizeFormulaText(cell) : cell;
    });

    return { rowNumber: record.rowNumber, values, errors };
  });
}

export function createHoldingsCsvTemplate(): string {
  return "ticker,shares,avg_cost,currency,tags\r\n";
}
