import type { DB } from "./database";
import type { Currency, Row } from "../shared/contracts";
import {
  convertMinor,
  type MoneyQuote,
  type RateSnapshot,
} from "../shared/exchange";
import { DomainError } from "./errors";
export class MoneyLedger {
  constructor(private db: DB) {}
  quote(
    amount: number,
    from: Currency,
    to: Currency,
    rateId?: number,
  ): MoneyQuote {
    let rate: RateSnapshot | null = null;
    if (from !== to) {
      const r = this.db
        .prepare("SELECT * FROM exchange_rates WHERE id=?")
        .get(rateId ?? -1) as Row | undefined;
      if (!r || r.source_currency !== from || r.target_currency !== to)
        throw new DomainError("RATE_REQUIRED");
      rate = {
        id: r.id,
        from,
        to,
        numerator: r.numerator,
        denominator: r.denominator,
        basis: r.basis,
        source: r.source,
        created: r.created,
        actor: r.actor,
      };
    }
    let value: number;
    try {
      value = convertMinor(
        amount,
        from,
        to,
        rate?.numerator ?? 1,
        rate?.denominator ?? 1,
        rate?.basis ?? "major",
      );
    } catch (e: any) {
      throw new DomainError(e.message);
    }
    return {
      originalAmount: amount,
      originalCurrency: from,
      amount: value,
      currency: to,
      rate,
      rounding: "HALF_UP",
      appliedAt: new Date().toISOString(),
    };
  }
  add(
    request: string,
    target: string,
    id: number,
    amount: number,
    currency: Currency,
    method: string,
    direction: string,
    quote?: MoneyQuote,
  ) {
    if (amount <= 0) return null;
    const q = quote ?? this.quote(amount, currency, currency);
    if (q.amount !== amount || q.currency !== currency)
      throw new DomainError("CURRENCY_MISMATCH");
    const result = this.db
      .prepare(
        "INSERT INTO payments(request,target,target_id,amount,currency,method,direction,created,original_amount,original_currency,fx,received_amount,change_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        request,
        target,
        id,
        amount,
        currency,
        method,
        direction,
        new Date().toISOString(),
        q.originalAmount,
        q.originalCurrency,
        JSON.stringify(q),
        q.receivedAmount ?? q.originalAmount,
        q.changeAmount ?? 0,
      );
    return Number(result.lastInsertRowid);
  }
  /** Refund original tenders FIFO. Floor cumulative source units; final refund releases every residual unit. */
  refund(
    request: string,
    target: string,
    id: number,
    amount: number,
    currency: Currency,
    tradeOnly = false,
  ) {
    if (amount === 0) return;
    const originalDirection = target === "purchase" ? "out" : "in";
    const originals = this.db
      .prepare(
        `SELECT p.*,COALESCE((SELECT SUM(amount) FROM payment_refunds WHERE original_id=p.id),0) refunded,COALESCE((SELECT SUM(original_amount) FROM payment_refunds WHERE original_id=p.id),0) source_refunded FROM payments p WHERE target=? AND target_id=? AND direction=? AND ${tradeOnly ? "method='Trade-in'" : "method!='Trade-in'"} ORDER BY id`,
      )
      .all(target, id, originalDirection) as Row[];
    let remaining = amount,
      index = 0;
    for (const p of originals) {
      if (!remaining) break;
      const available = p.amount - p.refunded;
      const credited = Math.min(remaining, available);
      if (credited <= 0) continue;
      const cumulative = Number(
        (BigInt(p.original_amount) * BigInt(p.refunded + credited)) /
          BigInt(p.amount),
      );
      const source = cumulative - p.source_refunded;
      const prior = JSON.parse(p.fx || "{}");
      const q: MoneyQuote = {
        originalAmount: source,
        originalCurrency: p.original_currency,
        amount: credited,
        currency,
        rate: prior.rate ?? null,
        rounding: "HALF_UP",
        appliedAt: new Date().toISOString(),
      };
      const refundId = this.add(
        `${request}:${index++}`,
        target,
        id,
        credited,
        currency,
        p.method,
        originalDirection === "in" ? "out" : "in",
        q,
      )!;
      this.db
        .prepare(
          "INSERT INTO payment_refunds(original_id,refund_id,amount,original_amount) VALUES(?,?,?,?)",
        )
        .run(p.id, refundId, credited, source);
      remaining -= credited;
    }
    if (remaining) throw new DomainError("REFUND_EXCEEDS_COLLECTIONS");
  }
}
