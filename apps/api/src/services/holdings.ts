import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  HoldingCreateSchema, HoldingImportRowSchema, HoldingTickerSchema, HoldingUpdateSchema,
  type HoldingCreateInput, type HoldingImportRow,
} from "@folioagent/shared";
import { HoldingsCsvError, parseHoldingsCsv, type ParsedHoldingCsvRow } from "../imports/holdings-csv.js";
import { HoldingsRepositoryError, type HoldingTicker, type HoldingWrite, type StoredHolding } from "../repositories/holdings.js";

export type { HoldingTicker, StoredHolding } from "../repositories/holdings.js";
export interface HoldingsRepositoryPort {
  list(): Promise<StoredHolding[]>;
  findTicker(symbol: string): Promise<HoldingTicker | null>;
  findTickers(symbols: readonly string[]): Promise<HoldingTicker[]>;
  findExistingTickers(symbols: readonly string[]): Promise<string[]>;
  create(row: HoldingWrite): Promise<StoredHolding>;
  update(symbol: string, fields: Partial<Pick<HoldingWrite, "shares" | "avg_cost" | "tags">>): Promise<StoredHolding | null>;
  delete(symbol: string): Promise<boolean>;
  insertMany(rows: readonly HoldingWrite[]): Promise<StoredHolding[]>;
}

export class HoldingsServiceError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) {
    super(message);
    this.name = "HoldingsServiceError";
  }
}

interface PreviewRow {
  rowNumber: number;
  status: "valid" | "skipped";
  values: Record<string, string>;
  errors: Array<{ field: string; reason: string }>;
}
interface TokenPayload { userId: string; csvHash: string; stateHash: string; expires: number }

function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export class HoldingsService {
  constructor(private readonly repository: HoldingsRepositoryPort, private readonly userId: string, private readonly secret: string) {
    if (secret.length < 32) throw new Error("HOLDINGS_IMPORT_SECRET must contain at least 32 characters");
  }

  async list() { return this.repository.list(); }

  async create(input: unknown) {
    const parsed = HoldingCreateSchema.safeParse(input);
    if (!parsed.success) throw new HoldingsServiceError(400, "Invalid holding", parsed.error.issues);
    if (!(await this.repository.findTicker(parsed.data.ticker))) throw new HoldingsServiceError(422, "Unknown ticker");
    try { return await this.repository.create(parsed.data as HoldingCreateInput); }
    catch (error) { if (this.isConflict(error)) throw new HoldingsServiceError(409, "This ticker is already in your holdings"); throw error; }
  }

  async update(rawTicker: string, input: unknown) {
    const ticker = HoldingTickerSchema.safeParse(rawTicker);
    const parsed = HoldingUpdateSchema.safeParse(input);
    if (!ticker.success || !parsed.success) throw new HoldingsServiceError(400, "Invalid holding update", parsed.success ? undefined : parsed.error.issues);
    const fields: Partial<Pick<HoldingWrite, "shares" | "avg_cost" | "tags">> = {};
    if (parsed.data.shares !== undefined) fields.shares = parsed.data.shares;
    if (parsed.data.avg_cost !== undefined) fields.avg_cost = parsed.data.avg_cost;
    if (parsed.data.tags !== undefined) fields.tags = parsed.data.tags;
    const row = await this.repository.update(ticker.data, fields);
    if (!row) throw new HoldingsServiceError(404, "Holding not found");
    return row;
  }

  async delete(rawTicker: string) {
    const ticker = HoldingTickerSchema.safeParse(rawTicker);
    if (!ticker.success) throw new HoldingsServiceError(400, "Invalid ticker");
    if (!(await this.repository.delete(ticker.data))) throw new HoldingsServiceError(404, "Holding not found");
    return { deleted: true };
  }

  async previewCsv(csv: string) {
    const parsedRows = this.parseCsv(csv);
    const analyzed = await this.analyze(parsedRows);
    const stateHash = await this.snapshot(analyzed.map((row) => row.values["ticker"] ?? "").filter((value): value is string => value.length > 0));
    const payload: TokenPayload = { userId: this.userId, csvHash: digest(csv), stateHash, expires: Date.now() + 15 * 60_000 };
    return {
      rows: analyzed,
      willImport: analyzed.filter((row) => row.status === "valid").length,
      skipped: analyzed.filter((row) => row.status === "skipped").length,
      previewToken: this.sign(payload),
    };
  }

  async confirmCsv(csv: string, token: string) {
    const payload = this.verify(token);
    if (payload.userId !== this.userId || payload.expires < Date.now() || payload.csvHash !== digest(csv)) {
      throw new HoldingsServiceError(409, "Preview is invalid or expired; preview the CSV again");
    }
    const analyzed = await this.analyze(this.parseCsv(csv));
    const currentStateHash = await this.snapshot(analyzed.map((row) => row.values["ticker"] ?? "").filter((value): value is string => value.length > 0));
    if (currentStateHash !== payload.stateHash) throw new HoldingsServiceError(409, "Holdings or ticker data changed; preview the CSV again");
    const valid = analyzed.filter((row) => row.status === "valid").map((row) => row.write!);
    try {
      const inserted = await this.repository.insertMany(valid);
      return { inserted: inserted.length, skipped: analyzed.length - inserted.length };
    } catch (error) {
      if (this.isConflict(error)) throw new HoldingsServiceError(409, "A duplicate holding appeared; no rows were imported");
      throw error;
    }
  }

  private parseCsv(csv: string): ParsedHoldingCsvRow[] {
    try { return parseHoldingsCsv(csv); }
    catch (error) { if (error instanceof HoldingsCsvError) throw new HoldingsServiceError(error.status, error.message); throw error; }
  }

  private async analyze(rows: ParsedHoldingCsvRow[]): Promise<Array<PreviewRow & { write?: HoldingWrite }>> {
    const candidates: Array<PreviewRow & { data?: HoldingImportRow }> = rows.map((row) => {
      const sanitized = HoldingImportRowSchema.safeParse(row.values);
      const errors = [...row.errors];
      if (!sanitized.success) {
        for (const issue of sanitized.error.issues) errors.push({ field: String(issue.path[0] ?? "row"), reason: issue.message });
      }
      return { rowNumber: row.rowNumber, values: row.values, errors, status: errors.length || !sanitized.success ? "skipped" : "valid", ...(sanitized.success ? { data: sanitized.data } : {}) };
    });
    const validData = candidates.filter((row) => row.data).map((row) => row.data!);
    const symbols = [...new Set(validData.map((row) => row.ticker))];
    const [known, held] = await Promise.all([this.repository.findTickers(symbols), this.repository.findExistingTickers(symbols)]);
    const knownSymbols = new Set(known.map((row) => row.symbol));
    const heldSymbols = new Set(held);
    const counts = new Map<string, number>();
    for (const row of validData) counts.set(row.ticker, (counts.get(row.ticker) ?? 0) + 1);
    return candidates.map((row) => {
      if (!row.data) return { rowNumber: row.rowNumber, values: row.values, errors: row.errors, status: "skipped" };
      const errors = [...row.errors];
      if (!knownSymbols.has(row.data.ticker)) errors.push({ field: "ticker", reason: "Unknown ticker" });
      if (heldSymbols.has(row.data.ticker)) errors.push({ field: "ticker", reason: "Ticker is already in your holdings" });
      if ((counts.get(row.data.ticker) ?? 0) > 1) errors.push({ field: "ticker", reason: "Ticker appears more than once in this file" });
      return { rowNumber: row.rowNumber, values: row.values, errors, status: errors.length ? "skipped" : "valid", ...(errors.length ? {} : { write: { ticker: row.data.ticker, shares: row.data.shares, avg_cost: row.data.avg_cost, tags: row.data.tags } }) };
    });
  }

  private async snapshot(symbols: string[]): Promise<string> {
    const unique = [...new Set(symbols)].sort();
    const [known, held] = await Promise.all([this.repository.findTickers(unique), this.repository.findExistingTickers(unique)]);
    return digest(JSON.stringify({ known: known.map((row) => [row.symbol, row.name, row.sector, row.industry, row.currency]).sort(), held: [...held].sort() }));
  }

  private sign(payload: TokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${createHmac("sha256", this.secret).update(body).digest("base64url")}`;
  }

  private verify(token: string): TokenPayload {
    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra) throw new HoldingsServiceError(409, "Invalid preview token");
    const expected = createHmac("sha256", this.secret).update(body).digest();
    let actual: Buffer;
    try { actual = Buffer.from(signature, "base64url"); } catch { throw new HoldingsServiceError(409, "Invalid preview token"); }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new HoldingsServiceError(409, "Invalid preview token");
    try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload; }
    catch { throw new HoldingsServiceError(409, "Invalid preview token"); }
  }

  private isConflict(error: unknown): boolean {
    return (error instanceof HoldingsRepositoryError && error.code === "23505") || (typeof error === "object" && error !== null && "code" in error && error.code === "23505");
  }
}
