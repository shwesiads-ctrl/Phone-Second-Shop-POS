import type { Currency } from "./contracts";
export const MONEY_LIMIT = 1_000_000_000_000;
export const precision: Record<Currency, number> = {
  MMK: 1,
  THB: 100,
  USD: 100,
};
export type RateSnapshot = {
  id: number;
  from: Currency;
  to: Currency;
  numerator: number;
  denominator: number;
  basis: "major" | "minor";
  source: string;
  created: string;
  actor: number;
};
export type MoneyQuote = {
  receivedAmount?: number;
  changeAmount?: number;
  originalAmount: number;
  originalCurrency: Currency;
  amount: number;
  currency: Currency;
  rate: RateSnapshot | null;
  rounding: "HALF_UP";
  appliedAt: string;
};
export function convertMinor(
  amount: number,
  from: Currency,
  to: Currency,
  numerator: number,
  denominator: number,
  basis: "major" | "minor" = "major",
) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > MONEY_LIMIT ||
    ![numerator, denominator].every(
      (v) => Number.isSafeInteger(v) && v > 0 && v <= 1_000_000_000,
    ) ||
    !precision[from] ||
    !precision[to]
  )
    throw new Error("INVALID_RATE");
  const n =
    BigInt(amount) *
    BigInt(numerator) *
    BigInt(basis === "major" ? precision[to] : 1);
  const d =
    BigInt(denominator) * BigInt(basis === "major" ? precision[from] : 1);
  const result = (2n * n + d) / (2n * d);
  if (result > BigInt(MONEY_LIMIT)) throw new Error("INVALID_MONEY");
  return Number(result);
}

/** Exact signed aggregation, rejecting results outside the JS/SQLite bridge's safe integer range. */
export function exactAggregate(...values: number[]): number {
  if (!values.every(Number.isSafeInteger)) throw new Error("INVALID_MONEY");
  const total = values.reduce((n, v) => n + BigInt(v), 0n);
  if (
    total > BigInt(Number.MAX_SAFE_INTEGER) ||
    total < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("INVALID_MONEY");
  return Number(total);
}
