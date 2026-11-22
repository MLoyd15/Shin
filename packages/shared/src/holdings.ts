import Decimal from "decimal.js";
import { z } from "zod";

const decimalText = (
  label: string,
  maxIntegerDigits: number,
  maxFractionDigits: number,
  predicate: (value: Decimal) => boolean,
  predicateMessage: string,
) =>
  z
    .string()
    .trim()
    .max(maxIntegerDigits + maxFractionDigits + 2, `${label} exceeds database precision`)
    .regex(/^[+-]?\d+(?:\.\d+)?$/, `${label} must be a plain decimal string`)
    .superRefine((value, context) => {
      const unsigned = value.replace(/^[+-]/, "");
      const [integerPart = "", fractionalPart = ""] = unsigned.split(".");
      const significantIntegerDigits = integerPart.replace(/^0+/, "").length || 1;

      if (significantIntegerDigits > maxIntegerDigits) {
        context.addIssue({ code: "custom", message: `${label} exceeds database precision` });
      }
      if (fractionalPart.length > maxFractionDigits) {
        context.addIssue({ code: "custom", message: `${label} has too many decimal places` });
      }

      let decimal: Decimal;
      try {
        decimal = new Decimal(value);
      } catch {
        context.addIssue({ code: "custom", message: `${label} must be finite` });
        return;
      }
      if (!decimal.isFinite()) {
        context.addIssue({ code: "custom", message: `${label} must be finite` });
      } else if (!predicate(decimal)) {
        context.addIssue({ code: "custom", message: predicateMessage });
      }
    })
    .transform((value) => new Decimal(value).toString());

const sharesSchema = decimalText(
  "shares",
  16,
  12,
  (value) => value.gt(0),
  "shares must be greater than zero",
);

const averageCostSchema = decimalText(
  "avg_cost",
  12,
  8,
  (value) => value.gte(0),
  "avg_cost must be non-negative",
);

const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9.-]{0,14}$/, "ticker must be a valid symbol");

export const HoldingTickerSchema = tickerSchema;

const normalizedTagsSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .max(32, "each tag must be at most 32 characters")
      .refine(
        (tag) => !Array.from(tag).some((character) => {
          const code = character.charCodeAt(0);
          return code <= 31 || code === 127;
        }),
        "tags cannot contain control characters",
      ),
  )
  .default([])
  .transform((tags) => [...new Set(tags.filter(Boolean))])
  .refine((tags) => tags.length <= 10, "a holding can have at most 10 tags");

const importedTagsSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.split(";") : (value ?? [])),
  normalizedTagsSchema,
);

const currencySchema = z.preprocess(
  (value) => (value === undefined || value === "" ? "USD" : value),
  z.string().trim().toUpperCase().pipe(z.literal("USD", "currency must be USD")),
);

export const HoldingCreateSchema = z
  .object({
    ticker: tickerSchema,
    shares: sharesSchema,
    avg_cost: averageCostSchema,
    tags: normalizedTagsSchema,
  })
  .strict();

export const HoldingUpdateSchema = z
  .object({
    shares: sharesSchema.optional(),
    avg_cost: averageCostSchema.optional(),
    tags: normalizedTagsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "at least one editable field is required");

export const HoldingImportRowSchema = z
  .object({
    ticker: tickerSchema,
    shares: sharesSchema,
    avg_cost: averageCostSchema,
    currency: currencySchema,
    tags: importedTagsSchema,
  })
  .strict();

export type HoldingCreateInput = z.infer<typeof HoldingCreateSchema>;
export type HoldingUpdateInput = z.infer<typeof HoldingUpdateSchema>;
export type HoldingImportRow = z.infer<typeof HoldingImportRowSchema>;
