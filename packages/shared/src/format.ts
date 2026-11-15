import Decimal from "decimal.js";

export type ExactDecimalValue = Decimal | string;

function toDecimal(value: ExactDecimalValue): Decimal {
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) {
    throw new RangeError("Expected a finite decimal value");
  }
  return decimal;
}

function formatExact(formatter: Intl.NumberFormat, value: string): string {
  return (formatter.format as unknown as (input: string) => string)(value);
}

export function formatCurrency(
  value: ExactDecimalValue,
  currency = "USD",
  locale = "en-US",
): string {
  const decimal = toDecimal(value);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatExact(formatter, decimal.toFixed(2));
}

export function formatPercent(
  value: ExactDecimalValue,
  fractionDigits = 2,
  locale = "en-US",
): string {
  const decimal = toDecimal(value);
  const formatter = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return formatExact(formatter, decimal.toString());
}

export function formatCompact(
  value: ExactDecimalValue,
  fractionDigits = 1,
  locale = "en-US",
): string {
  const decimal = toDecimal(value);
  const formatter = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: fractionDigits,
  });

  return formatExact(formatter, decimal.toString());
}

export function formatDate(value: Date | string, locale = "en-US"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Expected a valid date");
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
