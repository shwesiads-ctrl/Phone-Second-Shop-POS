import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { DB } from "./database";
import { transaction } from "./database";
import { MoneyLedger } from "./money-ledger";
import { exactAggregate, type MoneyQuote } from "../shared/exchange";
import { DomainError } from "./errors";
export { DomainError } from "./errors";
import { schemas, validIMEI } from "./validation";
import type { Currency, Operation, Role, Row, User } from "../shared/contracts";
const now = () => new Date().toISOString();
const managers: Role[] = ["Owner", "Admin"];
const stock: Role[] = [...managers, "Stock Manager"];
const tills: Role[] = [...managers, "Cashier"];
const technicians: Role[] = [...managers, "Technician"];
const access: Partial<Record<Operation, Role[]>> = {
  exchange: managers,
  paymentMethod: managers,
  inspectionUpdate: stock,
  wholesale: tills,
  reportConvert: managers,
  cashMovement: managers,
  repairReopen: managers,
  repairCancel: managers,
  warrantyUpdate: managers,
  photo: [...stock, "Technician"],
  label: [...stock, "Cashier"],
  permission: ["Owner"],
  repairPart: technicians,
  replenish: stock,
  rate: managers,
  hold: tills,
  resume: tills,
  users: ["Owner"],
  settings: managers,
  purchase: stock,
  purchaseReverse: managers,
  accessory: stock,
  adjust: stock,
  sale: tills,
  payment: tills,
  return: managers,
  inspect: stock,
  repair: [...tills, "Technician"],
  repairUpdate: technicians,
  warranty: tills,
  expense: managers,
  cashSession: tills,
  backup: managers,
  restore: ["Owner"],
  export: managers,
};

function assert(ok: unknown, code: string): asserts ok {
  if (!ok) throw new DomainError(code);
}
function hash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function verify(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  const input = scryptSync(password, salt, 64);
  return timingSafeEqual(input, Buffer.from(digest, "hex"));
}
function safeSum(values: number[]) {
  const total = values.reduce((a, b) => a + BigInt(b), 0n);
  assert(total >= 0n && total <= 1_000_000_000_000n, "INVALID_MONEY");
  return Number(total);
}
function product(a: number, b: number) {
  return safeSum([Number(BigInt(a) * BigInt(b))]);
}
export class ShopService {
  private session: User | null = null;
  private expires = 0;
  private attempts = 0;
  private retryAt = 0;
  readonly ledger: MoneyLedger;
  constructor(public db: DB) {
    this.ledger = new MoneyLedger(db);
  }
  row(sql: string, ...params: any[]): Row | undefined {
    return this.db.prepare(sql).get(...params) as Row | undefined;
  }
  rows(sql: string, ...params: any[]): Row[] {
    return this.db.prepare(sql).all(...params) as Row[];
  }
  run(sql: string, ...params: any[]) {
    return this.db.prepare(sql).run(...params);
  }
  get user() {
    if (Date.now() > this.expires) this.session = null;
    return this.session;
  }
  require(operation: Operation) {
    assert(this.user, "UNAUTHENTICATED");
    const allowed = access[operation];
    const custom = this.row(
      "SELECT allowed FROM permissions WHERE user_id=? AND operation=?",
      this.user.id,
      operation,
    );
    assert(
      this.user.role === "Owner" ||
        (custom
          ? custom.allowed === 1
          : !allowed || allowed.includes(this.user.role)),
      "FORBIDDEN",
    );
    this.expires = Date.now() + 30 * 60 * 1000;
    return this.user;
  }
  audit(action: string, entity: string, details: Row = {}) {
    this.run(
      "INSERT INTO audit(actor,action,entity,details,created) VALUES(?,?,?,?,?)",
      this.user?.id ?? null,
      action,
      entity,
      JSON.stringify(details),
      now(),
    );
  }
  movement(
    kind: string,
    id: number,
    delta: number,
    reason: string,
    reference: string,
  ) {
    this.run(
      "INSERT INTO stock_movements(kind,product_id,delta,reason,reference,actor,created) VALUES(?,?,?,?,?,?,?)",
      kind,
      id,
      delta,
      reason,
      reference,
      this.user!.id,
      now(),
    );
  }
  paid(target: string, id: number) {
    return Number(
      this.row(
        "SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS amount FROM payments WHERE target=? AND target_id=?",
        target,
        id,
      )!.amount,
    );
  }
  purchasePaid(id: number) {
    return 0 - this.paid("purchase", id);
  }
  addPayment(
    request: string,
    target: string,
    id: number,
    amount: number,
    currency: string,
    method: string,
    direction: string,
    quote?: MoneyQuote,
  ) {
    return this.ledger.add(
      request,
      target,
      id,
      amount,
      currency as Currency,
      method,
      direction,
      quote,
    );
  }
  private tenderQuote(p: any, target: Currency): MoneyQuote {
    const q = this.ledger.quote(
      p.amount,
      p.currency ?? target,
      target,
      p.rateId,
    );
    const received = p.received ?? p.amount;
    assert(
      received >= p.amount && (p.method === "Cash" || received === p.amount),
      "INVALID_MONEY",
    );
    return {
      ...q,
      receivedAmount: received,
      changeAmount: received - p.amount,
    };
  }
  settings() {
    return Object.fromEntries(
      this.rows("SELECT key,value FROM settings").map((r) => [
        r.key,
        JSON.parse(r.value),
      ]),
    );
  }
  invoke(operation: Operation, raw: unknown = {}): any {
    const input = (schemas[operation] as any).parse(raw ?? {});
    if (operation === "status")
      return {
        initialized: !!this.row("SELECT id FROM users LIMIT 1"),
        user: this.user,
        settings: this.settings(),
      };
    if (operation === "setup")
      return transaction(this.db, () => {
        assert(
          !this.row("SELECT id FROM users LIMIT 1"),
          "ALREADY_INITIALIZED",
        );
        const result = this.run(
          "INSERT INTO users(username,password,role) VALUES(?,?,?)",
          input.username,
          hash(input.password),
          "Owner",
        );
        this.session = {
          id: Number(result.lastInsertRowid),
          username: input.username,
          role: "Owner",
        };
        this.expires = Date.now() + 30 * 60 * 1000;
        this.audit("owner.setup", String(result.lastInsertRowid));
        return this.user;
      });
    if (operation === "login") {
      assert(Date.now() >= this.retryAt, "LOGIN_DELAY");
      const found = this.row(
        "SELECT * FROM users WHERE username=? AND active=1",
        input.username,
      );
      // Always perform scrypt, including unknown usernames.
      const ok = verify(
        input.password,
        found?.password ??
          "00000000000000000000000000000000:" + "00".repeat(64),
      );
      if (!found || !ok) {
        this.attempts++;
        this.retryAt =
          Date.now() +
          Math.min(60000, 1000 * 2 ** Math.min(this.attempts - 1, 6));
        throw new DomainError("LOGIN_FAILED");
      }
      this.session = {
        id: found.id,
        username: found.username,
        role: found.role,
      };
      this.expires = Date.now() + 30 * 60 * 1000;
      this.attempts = 0;
      this.retryAt = 0;
      this.audit("login", String(found.id));
      return this.user;
    }
    this.require(operation);
    const validMethod = (name: string) =>
      assert(
        this.row(
          "SELECT name FROM payment_methods WHERE name=? AND active=1",
          name,
        ),
        "INVALID_METHOD",
      );
    if (input.method) validMethod(input.method);
    if (input.payments)
      for (const payment of input.payments) validMethod(payment.method);
    if (operation === "wholesale") return true;
    if (operation === "paymentMethod")
      return transaction(this.db, () => {
        assert(input.name !== "Trade-in", "INVALID_METHOD");
        this.run(
          "INSERT INTO payment_methods(name,active) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET active=excluded.active",
          input.name,
          input.active ? 1 : 0,
        );
        this.audit("payment.method", input.name, { active: input.active });
        return true;
      });
    if (operation === "inspectionUpdate")
      return transaction(this.db, () => {
        const phone = this.row("SELECT * FROM phones WHERE id=?", input.id);
        assert(
          phone && ["available", "inspection"].includes(phone.status),
          "STOCK_UNAVAILABLE",
        );
        this.run(
          "UPDATE phones SET inspection=?,details=? WHERE id=?",
          JSON.stringify(input.inspection),
          input.details,
          input.id,
        );
        this.audit("phone.inspection", String(input.id), {
          reason: input.reason,
          before: JSON.parse(phone.inspection),
          after: input.inspection,
        });
        return true;
      });
    if (operation === "exchange")
      return transaction(this.db, () => {
        this.require("return");
        this.require("sale");
        const prior = this.row(
          "SELECT * FROM exchanges WHERE request=?",
          input.request,
        );
        if (prior)
          return { returnId: prior.return_id, saleId: prior.replacement_sale };
        const returned = schemas.return.parse({
          ...input.return,
          request: randomUUID(),
        });
        const replacement = schemas.sale.parse({
          ...input.sale,
          request: randomUUID(),
        });
        for (const p of replacement.payments) validMethod(p.method);
        const returnId = this.returnSale(returned);
        const saleId = this.sale(replacement);
        this.run(
          "INSERT INTO exchanges(request,original_sale,return_id,replacement_sale,created) VALUES(?,?,?,?,?)",
          input.request,
          returned.id,
          returnId,
          saleId,
          now(),
        );
        this.audit("sale.exchange", String(saleId), {
          original: returned.id,
          returnId,
        });
        return { returnId, saleId };
      });

    if (operation === "logout") {
      this.audit("logout", String(this.user!.id));
      this.session = null;
      return null;
    }
    if (operation === "quote")
      return this.ledger.quote(
        input.amount,
        input.currency,
        input.targetCurrency,
        input.rateId,
      );
    if (operation === "reportConvert")
      return transaction(this.db, () => {
        const selectedRates = input.rates.map((id: number) =>
          this.row("SELECT * FROM exchange_rates WHERE id=?", id),
        );
        assert(selectedRates.every(Boolean), "RATE_REQUIRED");
        const pairs = selectedRates.map(
          (r: Row) => `${r.source_currency}:${r.target_currency}`,
        );
        assert(new Set(pairs).size === pairs.length, "INVALID_RATE");
        const reports = this.snapshot({
          search: "",
          page: 0,
          from: input.from,
          to: input.to,
        }).reports;
        const converted = reports.map((report: Row) => {
          const selected = input.rates
            .map((id: number) =>
              this.row("SELECT * FROM exchange_rates WHERE id=?", id),
            )
            .find(
              (r: Row | undefined) =>
                r?.source_currency === report.currency &&
                r?.target_currency === input.currency,
            );
          const values: Row = {};

          let applied: MoneyQuote | null = null;
          for (const key of [
            "revenue",
            "cogs",
            "expenses",
            "repairRevenue",
            "repairCost",
            "received",
            "receivable",
            "payable",
          ]) {
            const value = Number(report[key]);
            if (!value && !selected && report.currency !== input.currency) {
              values[key] = 0;
              continue;
            }
            const q = this.ledger.quote(
              Math.abs(value),
              report.currency,
              input.currency,
              selected?.id,
            );
            applied = q;
            values[key] = value < 0 ? -q.amount : q.amount;
          }
          return { original: report, values, rate: applied?.rate ?? null };
        });
        const totals: Row = {};
        for (const key of [
          "revenue",
          "cogs",
          "expenses",
          "repairRevenue",
          "repairCost",
          "received",
          "receivable",
          "payable",
        ])
          totals[key] = converted
            .reduce((n: bigint, r: Row) => n + BigInt(r.values[key]), 0n)
            .toString();
        // Report-level conversion rounds each currency aggregate; never changes posted ledgers.
        totals.gross = (
          BigInt(totals.revenue) - BigInt(totals.cogs)
        ).toString();
        totals.net = (
          BigInt(totals.gross) +
          BigInt(totals.repairRevenue) -
          BigInt(totals.repairCost) -
          BigInt(totals.expenses)
        ).toString();
        const result = {
          currency: input.currency,
          totals,
          converted,
          from: input.from ?? null,
          to: input.to ?? null,
          created: now(),
          rounding: "HALF_UP_PER_CURRENCY_AGGREGATE",
        };
        const row = this.run(
          "INSERT INTO report_runs(currency,content,created,actor) VALUES(?,?,?,?)",
          input.currency,
          JSON.stringify(result),
          result.created,
          this.user!.id,
        );
        this.audit("report.convert", String(row.lastInsertRowid));
        return { ...result, id: Number(row.lastInsertRowid) };
      });
    if (operation === "snapshot") return this.snapshot(input);
    if (operation === "permission")
      return transaction(this.db, () => {
        const target = this.row(
          "SELECT role FROM users WHERE id=?",
          input.userId,
        );
        assert(target && target.role !== "Owner", "FORBIDDEN");
        this.run(
          "INSERT INTO permissions(user_id,operation,allowed) VALUES(?,?,?) ON CONFLICT(user_id,operation) DO UPDATE SET allowed=excluded.allowed",
          input.userId,
          input.operation,
          input.allowed ? 1 : 0,
        );
        this.audit("permission.set", String(input.userId), {
          operation: input.operation,
          allowed: input.allowed,
        });
        return true;
      });
    if (operation === "rate")
      return transaction(this.db, () => {
        assert(input.from !== input.to, "CURRENCY_MISMATCH");
        const r = this.run(
          "INSERT INTO exchange_rates(source_currency,target_currency,numerator,denominator,source,created,actor,basis) VALUES(?,?,?,?,?,?,?,'major')",
          input.from,
          input.to,
          input.numerator,
          input.denominator,
          input.source,
          now(),
          this.user!.id,
        );
        this.audit("exchange.rate", String(r.lastInsertRowid));
        return Number(r.lastInsertRowid);
      });
    if (operation === "hold")
      return transaction(this.db, () => {
        const r = this.run(
          "INSERT INTO held_carts(label,user_id,content,created) VALUES(?,?,?,?)",
          input.label,
          this.user!.id,
          input.content,
          now(),
        );
        this.audit("cart.hold", String(r.lastInsertRowid));
        return Number(r.lastInsertRowid);
      });
    if (operation === "resume")
      return transaction(this.db, () => {
        const cart = this.row(
          "SELECT * FROM held_carts WHERE id=? AND user_id=?",
          input.id,
          this.user!.id,
        );
        assert(cart, "NOT_FOUND");
        this.run("DELETE FROM held_carts WHERE id=?", input.id);
        this.audit("cart.resume", String(input.id));
        return JSON.parse(cart.content);
      });
    if (operation === "repairPart")
      return transaction(this.db, () => {
        const duplicate = this.row(
          "SELECT id FROM repair_parts WHERE request=?",
          input.request,
        );
        if (duplicate) return duplicate.id;
        const repair = this.row("SELECT * FROM repairs WHERE id=?", input.id);
        const part = this.row(
          "SELECT * FROM accessories WHERE id=?",
          input.accessoryId,
        );
        assert(repair && part, "NOT_FOUND");
        assert(
          !["Delivered", "Cancelled"].includes(repair.status),
          "FINALIZED",
        );
        assert(repair.approved, "APPROVAL_REQUIRED");
        const quote = this.ledger.quote(
          part.cost,
          part.currency,
          repair.currency,
          input.rateId,
        );
        assert(part.quantity >= input.quantity, "OUT_OF_STOCK");
        const r = this.run(
          "INSERT INTO repair_parts(request,repair_id,accessory_id,quantity,cost,currency,created,fx) VALUES(?,?,?,?,?,?,?,?)",
          input.request,
          input.id,
          input.accessoryId,
          input.quantity,
          product(quote.amount, input.quantity),
          repair.currency,
          now(),
          JSON.stringify({ unit: quote, quantity: input.quantity }),
        );
        this.run(
          "UPDATE accessories SET quantity=quantity-? WHERE id=?",
          input.quantity,
          input.accessoryId,
        );
        this.movement(
          "accessory",
          input.accessoryId,
          -input.quantity,
          "Repair part",
          String(input.id),
        );
        this.audit("repair.part", String(r.lastInsertRowid));
        return Number(r.lastInsertRowid);
      });
    if (operation === "replenish")
      return transaction(this.db, () => {
        const duplicate = this.row(
          "SELECT id FROM replenishments WHERE request=?",
          input.request,
        );
        if (duplicate) return duplicate.id;
        const item = this.row("SELECT * FROM accessories WHERE id=?", input.id);
        assert(item, "NOT_FOUND");
        assert(
          this.row(
            "SELECT id FROM contacts WHERE id=? AND kind='supplier'",
            input.contactId,
          ),
          "NOT_FOUND",
        );
        const total = product(input.unitCost, input.quantity);
        const weighted = Number(
          (BigInt(item.quantity) * BigInt(item.cost) + BigInt(total)) /
            BigInt(item.quantity + input.quantity),
        );
        const r = this.run(
          "INSERT INTO replenishments(request,accessory_id,contact_id,quantity,unit_cost,currency,created) VALUES(?,?,?,?,?,?,?)",
          input.request,
          input.id,
          input.contactId,
          input.quantity,
          input.unitCost,
          item.currency,
          now(),
        );
        this.run(
          "UPDATE accessories SET quantity=quantity+?,cost=? WHERE id=?",
          input.quantity,
          weighted,
          input.id,
        );
        this.movement(
          "accessory",
          input.id,
          input.quantity,
          "Replenishment",
          String(r.lastInsertRowid),
        );
        // Replenishment is paid in full; capitalized stock expenditure is recorded separately from operating expenses.
        this.addPayment(
          input.request,
          "purchase",
          -Number(r.lastInsertRowid),
          total,
          item.currency,
          input.method,
          "out",
        );
        this.audit("accessory.replenish", String(r.lastInsertRowid));
        return Number(r.lastInsertRowid);
      });
    if (operation === "contactHistory") {
      const contact = this.row("SELECT * FROM contacts WHERE id=?", input.id);
      assert(contact, "NOT_FOUND");
      return {
        contact,
        sales: this.rows(
          "SELECT s.*,total-COALESCE((SELECT SUM(revenue) FROM returns WHERE sale_id=s.id),0)-COALESCE((SELECT SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END) FROM payments WHERE target='sale' AND target_id=s.id),0) balance FROM sales s WHERE contact_id=? ORDER BY id DESC LIMIT 100",
          input.id,
        ),
        purchases: this.rows(
          "SELECT p.*,CASE WHEN p.status='reversed' THEN 0 ELSE (SELECT cost FROM phones WHERE purchase_id=p.id)-COALESCE((SELECT SUM(CASE direction WHEN 'out' THEN amount ELSE -amount END) FROM payments WHERE target='purchase' AND target_id=p.id),0) END balance FROM purchases p WHERE contact_id=? ORDER BY id DESC LIMIT 100",
          input.id,
        ),
        repairs: this.rows(
          "SELECT * FROM repairs WHERE contact_id=? ORDER BY id DESC LIMIT 100",
          input.id,
        ),
        payments: this.rows(
          "SELECT * FROM payments WHERE (target='sale' AND target_id IN (SELECT id FROM sales WHERE contact_id=?)) OR (target='purchase' AND target_id IN (SELECT id FROM purchases WHERE contact_id=?)) OR (target='repair' AND target_id IN (SELECT id FROM repairs WHERE contact_id=?)) ORDER BY id DESC LIMIT 100",
          input.id,
          input.id,
          input.id,
        ),
      };
    }
    if (operation === "password") {
      const user = this.row(
        "SELECT password FROM users WHERE id=?",
        this.user!.id,
      )!;
      assert(verify(input.current, user.password), "LOGIN_FAILED");
      this.run(
        "UPDATE users SET password=? WHERE id=?",
        hash(input.password),
        this.user!.id,
      );
      this.audit("password.change", String(this.user!.id));
      return true;
    }
    if (operation === "users")
      return transaction(this.db, () => {
        const r = this.run(
          "INSERT INTO users(username,password,role) VALUES(?,?,?)",
          input.username,
          hash(input.password),
          input.role,
        );
        this.audit("user.create", String(r.lastInsertRowid), {
          role: input.role,
        });
        return Number(r.lastInsertRowid);
      });
    if (operation === "contact")
      return transaction(this.db, () => {
        const r = this.run(
          "INSERT INTO contacts(name,phone,address,kind) VALUES(?,?,?,?)",
          input.name,
          input.phone,
          input.address,
          input.kind,
        );
        this.audit("contact.create", String(r.lastInsertRowid));
        return Number(r.lastInsertRowid);
      });
    if (operation === "purchase") return this.purchase(input);
    if (operation === "purchaseReverse") return this.reversePurchase(input);
    if (operation === "accessory")
      return transaction(this.db, () => {
        const r = this.run(
          "INSERT INTO accessories(sku,barcode,name,category,cost,price,currency,quantity,reorder) VALUES(?,?,?,?,?,?,?,?,?)",
          input.sku,
          input.barcode,
          input.name,
          input.category,
          input.cost,
          input.price,
          input.currency,
          input.quantity,
          input.reorder,
        );
        const id = Number(r.lastInsertRowid);
        if (input.wholesale !== undefined)
          this.run(
            "UPDATE accessories SET wholesale=? WHERE id=?",
            input.wholesale,
            id,
          );
        this.movement(
          "accessory",
          id,
          input.quantity,
          "Opening stock",
          String(id),
        );
        this.audit("accessory.create", String(id));
        return id;
      });
    if (operation === "adjust")
      return transaction(this.db, () => {
        const item = this.row("SELECT * FROM accessories WHERE id=?", input.id);
        assert(item, "NOT_FOUND");
        assert(item.quantity + input.delta >= 0, "OUT_OF_STOCK");
        this.run(
          "UPDATE accessories SET quantity=quantity+? WHERE id=?",
          input.delta,
          input.id,
        );
        this.movement(
          "accessory",
          input.id,
          input.delta,
          input.reason,
          "adjustment",
        );
        this.audit("stock.adjust", String(input.id), input);
        return true;
      });
    if (operation === "sale") return this.sale(input);
    if (operation === "payment") return this.payment(input);
    if (operation === "return") return this.returnSale(input);
    if (operation === "inspect")
      return transaction(this.db, () => {
        assert(
          this.row(
            "SELECT id FROM phones WHERE id=? AND status='inspection'",
            input.id,
          ),
          "NOT_FOUND",
        );
        this.run("UPDATE phones SET status='available' WHERE id=?", input.id);
        this.audit("phone.inspected", String(input.id), {
          reason: input.reason,
        });
        return true;
      });
    if (operation === "repair")
      return transaction(this.db, () => {
        assert(
          this.row(
            "SELECT id FROM contacts WHERE id=? AND kind='customer'",
            input.contactId,
          ),
          "CUSTOMER_REQUIRED",
        );
        if (input.technician)
          assert(
            this.row(
              "SELECT id FROM users WHERE id=? AND role IN ('Owner','Admin','Technician')",
              input.technician,
            ),
            "NOT_FOUND",
          );
        const r = this.run(
          "INSERT INTO repairs(contact_id,device,identifier,problem,inspection,technician,estimate,currency,created) VALUES(?,?,?,?,?,?,?,?,?)",
          input.contactId,
          input.device,
          input.identifier,
          input.problem,
          input.inspection,
          input.technician ?? null,
          input.estimate,
          input.currency,
          now(),
        );
        const id = Number(r.lastInsertRowid);
        this.run(
          "UPDATE repairs SET ticket=? WHERE id=?",
          `REP-${String(id).padStart(6, "0")}`,
          id,
        );
        this.audit("repair.create", String(id));
        return id;
      });
    if (operation === "repairUpdate") return this.repairUpdate(input);
    if (operation === "repairCancel")
      return transaction(this.db, () => {
        const repair = this.row("SELECT * FROM repairs WHERE id=?", input.id);
        assert(
          repair && !["Delivered", "Cancelled"].includes(repair.status),
          "FINALIZED",
        );
        const paid = this.paid("repair", input.id);
        this.ledger.refund(
          `cancel-repair:${input.id}`,
          "repair",
          input.id,
          paid,
          repair.currency,
        );
        this.run(
          "UPDATE repairs SET status='Cancelled',closed_at=? WHERE id=?",
          now(),
          input.id,
        );
        this.run(
          "INSERT INTO repair_events(repair_id,status,reason,actor,created) VALUES(?,?,?,?,?)",
          input.id,
          "Cancelled",
          input.reason,
          this.user!.id,
          now(),
        );
        this.audit("repair.cancel", String(input.id), {
          reason: input.reason,
          refund: paid,
        });
        return input.id;
      });
    if (operation === "repairReopen")
      return transaction(this.db, () => {
        const repair = this.row("SELECT * FROM repairs WHERE id=?", input.id);
        assert(
          repair && ["Delivered", "Cancelled"].includes(repair.status),
          "FINALIZED",
        );
        const result = this.run(
          "INSERT INTO repairs(contact_id,device,identifier,problem,inspection,technician,estimate,currency,created,original_repair) VALUES(?,?,?,?,?,?,?,?,?,?)",
          repair.contact_id,
          repair.device,
          repair.identifier,
          repair.problem,
          input.reason,
          repair.technician,
          repair.estimate,
          repair.currency,
          now(),
          repair.id,
        );
        const id = Number(result.lastInsertRowid);
        this.run(
          "UPDATE repairs SET ticket=? WHERE id=?",
          `REP-${String(id).padStart(6, "0")}`,
          id,
        );
        this.audit("repair.reopen", String(id), {
          original: repair.id,
          reason: input.reason,
        });
        return id;
      });
    if (operation === "warrantyUpdate")
      return transaction(this.db, () => {
        assert(
          this.row("SELECT id FROM warranty_claims WHERE id=?", input.id),
          "NOT_FOUND",
        );
        this.run(
          "UPDATE warranty_claims SET status=?,resolution=? WHERE id=?",
          input.status,
          input.resolution,
          input.id,
        );
        this.audit("warranty.resolve", String(input.id), {
          status: input.status,
          resolution: input.resolution,
        });
        return input.id;
      });
    if (operation === "warranty")
      return transaction(this.db, () => {
        if (input.saleItem) {
          const item = this.row(
            "SELECT si.*,s.created,s.status,COALESCE((SELECT SUM(quantity) FROM return_items WHERE sale_item=si.id),0) returned FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE si.id=?",
            input.saleItem,
          );
          assert(
            item &&
              ["posted", "partially_returned"].includes(item.status) &&
              item.returned < item.quantity &&
              item.warranty_days > 0 &&
              Date.now() <=
                Date.parse(item.created) + item.warranty_days * 86400000,
            "WARRANTY_EXPIRED",
          );
        } else {
          const repair = this.row(
            "SELECT * FROM repairs WHERE id=?",
            input.repairId,
          );
          assert(
            repair &&
              repair.status === "Delivered" &&
              repair.warranty_days > 0 &&
              Date.now() <=
                Date.parse(repair.delivered) + repair.warranty_days * 86400000,
            "WARRANTY_EXPIRED",
          );
        }
        assert(
          !this.row(
            "SELECT id FROM warranty_claims WHERE (sale_item=? OR repair_id=?) AND status IN ('open','approved')",
            input.saleItem ?? null,
            input.repairId ?? null,
          ),
          "CONFLICT",
        );
        const result = this.run(
          "INSERT INTO warranty_claims(sale_item,repair_id,reason,created) VALUES(?,?,?,?)",
          input.saleItem ?? null,
          input.repairId ?? null,
          input.reason,
          now(),
        );
        this.audit("warranty.claim", String(result.lastInsertRowid));
        return Number(result.lastInsertRowid);
      });
    if (operation === "expense")
      return transaction(this.db, () => {
        const existing = this.row(
          "SELECT id FROM expenses WHERE request=?",
          input.request,
        );
        if (existing) return existing.id;
        const r = this.run(
          "INSERT INTO expenses(request,category,description,amount,currency,method,created) VALUES(?,?,?,?,?,?,?)",
          input.request,
          input.category,
          input.description,
          input.amount,
          input.currency,
          input.method,
          now(),
        );
        this.audit("expense.create", String(r.lastInsertRowid));
        return Number(r.lastInsertRowid);
      });
    if (operation === "cashMovement")
      return transaction(this.db, () => {
        const duplicate = this.row(
          "SELECT id FROM cash_movements WHERE request=?",
          input.request,
        );
        if (duplicate) return duplicate.id;
        const result = this.run(
          "INSERT INTO cash_movements(request,direction,amount,currency,reason,created,actor) VALUES(?,?,?,?,?,?,?)",
          input.request,
          input.direction,
          input.amount,
          input.currency,
          input.reason,
          now(),
          this.user!.id,
        );
        this.audit("cash.movement", String(result.lastInsertRowid), {
          direction: input.direction,
          reason: input.reason,
        });
        return Number(result.lastInsertRowid);
      });
    if (operation === "cashSession") return this.cashSession(input);
    if (operation === "settings")
      return transaction(this.db, () => {
        for (const [key, value] of Object.entries(input))
          this.run(
            "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            key,
            JSON.stringify(value),
          );
        this.audit("settings.update", "shop");
        return true;
      });
    throw new DomainError("DESKTOP_ONLY");
  }
  private purchase(p: any) {
    return transaction(this.db, () => this.purchaseBody(p));
  }
  private purchaseBody(p: any) {
    const existing = this.row(
      "SELECT id FROM purchases WHERE request=?",
      p.request,
    );
    if (existing) return existing.id;
    assert(
      this.row("SELECT id FROM contacts WHERE id=?", p.contactId),
      "NOT_FOUND",
    );
    const tender = this.ledger.quote(
      p.paid,
      p.paidCurrency ?? p.currency,
      p.currency,
      p.paidRateId,
    );
    assert(!p.paid || tender.amount > 0, "ZERO_CONVERSION");
    assert(tender.amount <= p.cost, "OVERPAYMENT");
    assert(p.minimum <= p.price, "BELOW_MINIMUM");
    for (const imei of [p.imei1, p.imei2])
      if (imei) assert(validIMEI(imei), "INVALID_IMEI");
    if (!p.imei1 && !p.imei2) {
      assert(
        p.alternate &&
          p.alternateApproved &&
          managers.includes(this.user!.role),
        "ALTERNATE_APPROVAL_REQUIRED",
      );
    }
    const identifiers = [p.imei1, p.imei2, p.alternate].filter(Boolean);
    assert(new Set(identifiers).size === identifiers.length, "DUPLICATE_IMEI");
    for (const identifier of identifiers)
      assert(
        !this.row("SELECT value FROM identifiers WHERE value=?", identifier),
        "DUPLICATE_IMEI",
      );
    const r = this.run(
      "INSERT INTO purchases(request,contact_id,currency,cost,paid,created) VALUES(?,?,?,?,?,?)",
      p.request,
      p.contactId,
      p.currency,
      p.cost,
      tender.amount,
      now(),
    );
    const id = Number(r.lastInsertRowid);
    const cost = safeSum([p.cost, p.refurbishment]);
    const phone = this.run(
      "INSERT INTO phones(purchase_id,brand,model,imei1,imei2,alternate,details,condition,grade,cost,price,minimum,currency,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      p.brand,
      p.model,
      p.imei1 || null,
      p.imei2 || null,
      p.alternate || null,
      p.details,
      p.condition,
      p.grade,
      cost,
      p.price,
      p.minimum,
      p.currency,
      now(),
    );
    const phoneId = Number(phone.lastInsertRowid);
    const inspection = Object.fromEntries(
      [
        "storage",
        "ram",
        "color",
        "network",
        "sim",
        "serial",
        "batteryHealth",
        "screen",
        "camera",
        "faceId",
        "fingerprint",
        "sensors",
        "included",
      ]
        .filter((key) => p[key] !== undefined)
        .map((key) => [key, p[key]]),
    );
    this.run(
      "UPDATE phones SET inspection=? WHERE id=?",
      JSON.stringify(inspection),
      phoneId,
    );
    for (const identifier of identifiers)
      this.run(
        "INSERT INTO identifiers(value,phone_id) VALUES(?,?)",
        identifier,
        phoneId,
      );
    this.addPayment(
      p.request,
      "purchase",
      id,
      tender.amount,
      p.currency,
      p.method,
      "out",
      tender,
    );
    // Refurbishment is capitalized, paid separately, and not expensed again in profit.
    if (p.refurbishment)
      this.addPayment(
        `${p.request}:refurb`,
        "purchase",
        id,
        p.refurbishment,
        p.currency,
        p.method,
        "out",
      );
    this.movement("phone", phoneId, 1, "Purchase", String(id));
    this.audit("purchase.post", String(id));
    return id;
  }
  private reversePurchase(p: any) {
    return transaction(this.db, () => {
      const purchase = this.row("SELECT * FROM purchases WHERE id=?", p.id);
      assert(purchase, "NOT_FOUND");
      if (purchase.status === "reversed") return p.id;
      assert(
        !this.row("SELECT sale_id FROM trade_ins WHERE purchase_id=?", p.id),
        "TRADE_RETURN_REVIEW",
      );
      const phone = this.row("SELECT * FROM phones WHERE purchase_id=?", p.id)!;
      assert(phone.status === "available", "STOCK_UNAVAILABLE");
      this.run("UPDATE purchases SET status='reversed' WHERE id=?", p.id);
      this.run("UPDATE phones SET status='reversed' WHERE id=?", phone.id);
      const paid = this.purchasePaid(p.id);
      const refund = p.refund ?? paid;
      assert(refund <= paid, "OVERPAYMENT");
      if (paid > refund)
        this.run(
          "INSERT INTO expenses(request,category,description,amount,currency,method,created) VALUES(?,?,?,?,?,?,?)",
          `reversal-loss:${p.id}`,
          "Purchase reversal loss",
          p.reason,
          paid - refund,
          purchase.currency,
          "Other",
          now(),
        );
      this.ledger.refund(
        p.request,
        "purchase",
        p.id,
        refund,
        purchase.currency,
      );
      this.movement("phone", phone.id, -1, p.reason, String(p.id));
      this.audit("purchase.reverse", String(p.id), { reason: p.reason });
      return p.id;
    });
  }
  private sale(p: any) {
    return transaction(this.db, () => {
      const existing = this.row(
        "SELECT id FROM sales WHERE request=?",
        p.request,
      );
      if (existing) return existing.id;
      if (p.contactId)
        assert(
          this.row(
            "SELECT id FROM contacts WHERE id=? AND kind='customer'",
            p.contactId,
          ),
          "CUSTOMER_REQUIRED",
        );
      const seen = new Set();
      let lines: Row[] = [];
      for (const line of p.items) {
        const key = `${line.kind}:${line.id}`;
        assert(!seen.has(key), "DUPLICATE_ITEM");
        seen.add(key);
        const item = this.row(
          line.kind === "phone"
            ? "SELECT * FROM phones WHERE id=?"
            : "SELECT * FROM accessories WHERE id=?",
          line.id,
        );
        assert(item, "NOT_FOUND");
        if (line.pricingTier === "wholesale") {
          this.require("wholesale");
          assert(
            line.kind === "accessory" && item.wholesale !== null,
            "WHOLESALE_UNAVAILABLE",
          );
        }
        const catalogue = this.ledger.quote(
          line.pricingTier === "wholesale" ? item.wholesale : item.price,
          item.currency,
          p.currency,
          line.rateId,
        );
        const basis = this.ledger.quote(
          item.cost,
          item.currency,
          p.currency,
          line.rateId,
        );
        const minimum = this.ledger.quote(
          item.minimum ?? 0,
          item.currency,
          p.currency,
          line.rateId,
        );
        assert(
          line.kind === "phone"
            ? item.status === "available" && line.quantity === 1
            : item.quantity >= line.quantity,
          "OUT_OF_STOCK",
        );
        assert(line.price >= minimum.amount, "BELOW_MINIMUM");
        assert(
          line.price >= catalogue.amount || managers.includes(this.user!.role),
          "DISCOUNT_PERMISSION",
        );
        lines.push({
          ...line,
          name:
            line.kind === "phone" ? `${item.brand} ${item.model}` : item.name,
          identifier: item.imei1 || item.alternate || item.sku || "",
          cost: basis.amount,
          minimum: minimum.amount,
          fx: { catalogue, cost: basis, minimum },
        });
      }
      assert(
        !p.discount || managers.includes(this.user!.role),
        "DISCOUNT_PERMISSION",
      );
      const subtotal = safeSum(lines.map((l) => product(l.price, l.quantity)));
      assert(p.discount <= subtotal, "INVALID_MONEY");
      const total = subtotal - p.discount;
      const tradeQuote = p.tradeIn
        ? this.ledger.quote(
            p.tradeIn.cost,
            p.tradeIn.currency ?? p.currency,
            p.currency,
            p.tradeIn.rateId,
          )
        : null;
      const tradeCredit = tradeQuote?.amount ?? 0;
      assert(!p.tradeIn?.cost || tradeCredit > 0, "ZERO_CONVERSION");
      const tenders = p.payments.map((v: any) => ({
        ...v,
        quote: this.tenderQuote(v, p.currency),
      }));
      for (const v of tenders) assert(v.quote.amount > 0, "ZERO_CONVERSION");
      const paid = safeSum([
        ...tenders.map((v: any) => v.quote.amount),
        tradeCredit,
      ]);
      assert(paid <= total, "OVERPAYMENT");
      assert(paid === total || p.contactId, "CUSTOMER_REQUIRED");
      // An invoice-level discount must also preserve each phone's minimum price.
      for (const line of lines)
        if (line.kind === "phone") {
          assert(
            BigInt(line.price) * BigInt(total) >=
              BigInt(line.minimum) * BigInt(subtotal),
            "BELOW_MINIMUM",
          );
        }
      const cost = safeSum(lines.map((l) => product(l.cost, l.quantity)));
      const r = this.run(
        "INSERT INTO sales(request,contact_id,currency,total,discount,cost,cashier,created) VALUES(?,?,?,?,?,?,?,?)",
        p.request,
        p.contactId ?? null,
        p.currency,
        total,
        p.discount,
        cost,
        this.user!.id,
        now(),
      );
      const id = Number(r.lastInsertRowid);
      this.run(
        "UPDATE sales SET invoice=?,receipt_settings=? WHERE id=?",
        `INV-${String(id).padStart(7, "0")}`,
        JSON.stringify(this.settings()),
        id,
      );
      for (const line of lines) {
        assert(
          line.warrantyType !== "none" || line.warrantyDays === 0,
          "INVALID_INPUT",
        );
        this.run(
          "INSERT INTO sale_items(sale_id,kind,product_id,name,identifier,quantity,price,cost,warranty_days,warranty_type,fx) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          id,
          line.kind,
          line.id,
          line.name,
          line.identifier,
          line.quantity,
          line.price,
          line.cost,
          line.warrantyDays,
          line.warrantyDays ? line.warrantyType || "shop" : "none",
          JSON.stringify(line.fx),
        );
        if (line.kind === "phone")
          this.run("UPDATE phones SET status='sold' WHERE id=?", line.id);
        else
          this.run(
            "UPDATE accessories SET quantity=quantity-? WHERE id=?",
            line.quantity,
            line.id,
          );
        this.movement(line.kind, line.id, -line.quantity, "Sale", String(id));
      }
      tenders.forEach((payment: any, index: number) =>
        this.addPayment(
          `${p.request}:${index}`,
          "sale",
          id,
          payment.quote.amount,
          p.currency,
          payment.method,
          "in",
          payment.quote,
        ),
      );
      if (p.tradeIn) {
        assert(managers.includes(this.user!.role), "FORBIDDEN");
        assert(p.contactId, "CUSTOMER_REQUIRED");
        const purchaseId = this.purchaseBody({
          ...p.tradeIn,
          request: `trade:${p.request}`,
          contactId: p.contactId,
          currency: p.tradeIn.currency ?? p.currency,
          paid: p.tradeIn.cost,
          refurbishment: 0,
          method: "Trade-in",
        });
        this.run(
          "INSERT INTO trade_ins(sale_id,purchase_id,credit,currency) VALUES(?,?,?,?)",
          id,
          purchaseId,
          tradeCredit,
          p.currency,
        );
        this.addPayment(
          `trade-sale:${p.request}`,
          "sale",
          id,
          tradeCredit,
          p.currency,
          "Trade-in",
          "in",
          tradeQuote!,
        );
      }
      this.audit("sale.post", String(id));
      return id;
    });
  }
  private payment(p: any) {
    return transaction(this.db, () => {
      const existing = this.row(
        "SELECT id FROM payments WHERE request=?",
        p.request,
      );
      if (existing) return existing.id;
      const table =
        p.target === "sale"
          ? "sales"
          : p.target === "purchase"
            ? "purchases"
            : "repairs";
      const target = this.row(`SELECT * FROM ${table} WHERE id=?`, p.id);
      assert(target, "NOT_FOUND");
      const tender = this.tenderQuote(p, target.currency);
      assert(tender.amount > 0, "ZERO_CONVERSION");
      assert(
        p.target === "repair"
          ? !["Delivered", "Cancelled"].includes(target.status)
          : ["posted", "partially_returned"].includes(target.status),
        "FINALIZED",
      );
      const paid =
        p.target === "purchase"
          ? this.purchasePaid(p.id)
          : this.paid(p.target, p.id);
      const capitalized =
        p.target === "purchase"
          ? this.row("SELECT cost FROM phones WHERE purchase_id=?", p.id)!.cost
          : 0;
      const total =
        p.target === "sale"
          ? target.total -
            Number(
              this.row(
                "SELECT COALESCE(SUM(revenue),0) n FROM returns WHERE sale_id=?",
                p.id,
              )!.n,
            )
          : p.target === "purchase"
            ? capitalized
            : target.final || target.estimate;
      assert(paid + tender.amount <= total, "OVERPAYMENT");
      this.addPayment(
        p.request,
        p.target,
        p.id,
        tender.amount,
        target.currency,
        p.method,
        p.target === "purchase" ? "out" : "in",
        tender,
      );
      this.audit("payment.record", `${p.target}:${p.id}`);
      return Number(
        this.row("SELECT id FROM payments WHERE request=?", p.request)!.id,
      );
    });
  }
  private returnSale(p: any) {
    return transaction(this.db, () => {
      const existing = this.row(
        "SELECT id FROM returns WHERE request=?",
        p.request,
      );
      if (existing) return existing.id;
      const sale = this.row("SELECT * FROM sales WHERE id=?", p.id);
      assert(
        sale && ["posted", "partially_returned"].includes(sale.status),
        "FINALIZED",
      );
      assert(!p.currency || p.currency === sale.currency, "CURRENCY_MISMATCH");
      const lines = this.rows(
        "SELECT si.*,COALESCE((SELECT SUM(quantity) FROM return_items WHERE sale_item=si.id),0) returned FROM sale_items si WHERE sale_id=? ORDER BY id",
        p.id,
      );
      const requested =
        p.items ??
        lines
          .filter((l) => l.quantity > l.returned)
          .map((l) => ({
            saleItem: l.id,
            quantity: l.quantity - l.returned,
            restock: true,
          }));
      const selected = new Map<number, any>();
      for (const item of requested) {
        assert(!selected.has(item.saleItem), "DUPLICATE_ITEM");
        selected.set(item.saleItem, item);
      }
      const subtotal = safeSum(lines.map((l) => product(l.price, l.quantity)));
      let cumulative = 0;
      let revenue = 0;
      let cost = 0;
      let consumed = 0;
      for (const line of lines) {
        const previous = cumulative;
        cumulative += line.price * line.quantity;
        const net = subtotal
          ? Number(
              (BigInt(cumulative) * BigInt(sale.total)) / BigInt(subtotal) -
                (BigInt(previous) * BigInt(sale.total)) / BigInt(subtotal),
            )
          : 0;
        const item = selected.get(line.id);
        if (!item) continue;
        consumed++;
        assert(item.quantity <= line.quantity - line.returned, "OUT_OF_STOCK");
        revenue += Number(
          (BigInt(net) * BigInt(line.returned + item.quantity)) /
            BigInt(line.quantity) -
            (BigInt(net) * BigInt(line.returned)) / BigInt(line.quantity),
        );
        cost += item.restock ? line.cost * item.quantity : 0;
      }
      assert(consumed === selected.size && consumed > 0, "NOT_FOUND");
      const previous = this.row(
        "SELECT COALESCE(SUM(revenue),0) n FROM returns WHERE sale_id=?",
        p.id,
      )!.n;
      const trade = this.row("SELECT * FROM trade_ins WHERE sale_id=?", p.id);
      if (trade) {
        assert(!p.items, "TRADE_RETURN_REVIEW");
        const acquired = this.row(
          "SELECT * FROM phones WHERE purchase_id=?",
          trade.purchase_id,
        )!;
        assert(acquired.status === "available", "STOCK_UNAVAILABLE");
      }
      const paid = this.paid("sale", p.id);
      const required = Math.max(
        0,
        paid - (trade?.credit ?? 0) - (sale.total - Number(previous) - revenue),
      );
      assert(p.refund === required, "FULL_RETURN_REFUND_REQUIRED");
      const result = this.run(
        "INSERT INTO returns(request,sale_id,refund,revenue,cost,currency,reason,created) VALUES(?,?,?,?,?,?,?,?)",
        p.request,
        p.id,
        p.refund,
        revenue,
        cost,
        sale.currency,
        p.reason,
        now(),
      );
      const returnId = Number(result.lastInsertRowid);
      this.ledger.refund(p.request, "sale", p.id, p.refund, sale.currency);
      if (trade) {
        const acquired = this.row(
          "SELECT * FROM phones WHERE purchase_id=?",
          trade.purchase_id,
        )!;
        this.run("UPDATE phones SET status='reversed' WHERE id=?", acquired.id);
        this.run(
          "UPDATE purchases SET status='reversed' WHERE id=?",
          trade.purchase_id,
        );
        this.ledger.refund(
          `trade-refund:${p.request}`,
          "sale",
          p.id,
          trade.credit,
          sale.currency,
          true,
        );
        const native = this.row(
          "SELECT * FROM purchases WHERE id=?",
          trade.purchase_id,
        )!;
        this.ledger.refund(
          `trade-reverse:${p.request}`,
          "purchase",
          trade.purchase_id,
          this.purchasePaid(trade.purchase_id),
          native.currency,
          true,
        );
        this.movement(
          "phone",
          acquired.id,
          -1,
          "Trade-in reversal",
          String(p.id),
        );
      }
      for (const line of lines) {
        const item = selected.get(line.id);
        if (!item) continue;
        this.run(
          "INSERT INTO return_items(return_id,sale_item,quantity,restock) VALUES(?,?,?,?)",
          returnId,
          line.id,
          item.quantity,
          item.restock ? 1 : 0,
        );
        if (line.kind === "phone")
          this.run(
            "UPDATE phones SET status=? WHERE id=?",
            item.restock ? "inspection" : "written_off",
            line.product_id,
          );
        else if (item.restock)
          this.run(
            "UPDATE accessories SET quantity=quantity+? WHERE id=?",
            item.quantity,
            line.product_id,
          );
        if (item.restock)
          this.movement(
            line.kind,
            line.product_id,
            item.quantity,
            p.reason,
            `return:${returnId}`,
          );
      }
      const complete = lines.every(
        (line) =>
          line.returned + (selected.get(line.id)?.quantity ?? 0) ===
          line.quantity,
      );
      this.run(
        "UPDATE sales SET status=? WHERE id=?",
        complete ? "returned" : "partially_returned",
        p.id,
      );
      this.audit("sale.return", String(p.id), {
        reason: p.reason,
        returnId,
        revenue,
        refund: p.refund,
      });
      return returnId;
    });
  }
  private repairUpdate(p: any) {
    return transaction(this.db, () => {
      const item = this.row("SELECT * FROM repairs WHERE id=?", p.id);
      assert(item, "NOT_FOUND");
      assert(!["Delivered", "Cancelled"].includes(item.status), "FINALIZED");
      const flow = [
        "Received",
        "Diagnosing",
        "Waiting for Approval",
        "Waiting for Parts",
        "Repairing",
        "Ready for Collection",
        "Delivered",
      ];
      const manager = managers.includes(this.user!.role);
      assert(
        p.status === item.status ||
          flow.indexOf(p.status) === flow.indexOf(item.status) + 1 ||
          (manager && p.reason),
        "INVALID_TRANSITION",
      );
      assert(
        !["Repairing", "Ready for Collection", "Delivered"].includes(
          p.status,
        ) || p.approved,
        "APPROVAL_REQUIRED",
      );
      const paid = this.paid("repair", p.id);
      assert(paid <= p.final || p.final === 0, "OVERPAYMENT");
      if (p.status === "Delivered") assert(paid === p.final, "BALANCE_DUE");
      assert(p.status !== "Cancelled", "INVALID_TRANSITION");
      this.run(
        "UPDATE repairs SET status=?,diagnosis=?,approved=?,final=?,warranty_days=?,delivered=? WHERE id=?",
        p.status,
        p.diagnosis,
        p.approved ? 1 : 0,
        p.final,
        p.warrantyDays,
        p.status === "Delivered" ? now() : null,
        p.id,
      );
      if (p.status === "Delivered")
        this.run("UPDATE repairs SET closed_at=? WHERE id=?", now(), p.id);
      this.run(
        "INSERT INTO repair_events(repair_id,status,reason,actor,created) VALUES(?,?,?,?,?)",
        p.id,
        p.status,
        p.reason,
        this.user!.id,
        now(),
      );
      this.audit("repair.update", String(p.id), {
        status: p.status,
        reason: p.reason,
      });
      return p.id;
    });
  }
  private cashBalance(currency: string, from: string, to = "9999") {
    // Shop cash movements: explicitly label this as shop-wide; closing uses the same policy.
    const payments = this.row(
      "SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN original_amount ELSE -original_amount END),0) AS n FROM payments WHERE original_currency=? AND method='Cash' AND created BETWEEN ? AND ?",
      currency,
      from,
      to,
    )!.n;
    const expenses = this.row(
      "SELECT COALESCE(SUM(amount),0) AS n FROM expenses WHERE currency=? AND method='Cash' AND created BETWEEN ? AND ?",
      currency,
      from,
      to,
    )!.n;
    const movements = this.row(
      "SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END),0) n FROM cash_movements WHERE currency=? AND created BETWEEN ? AND ?",
      currency,
      from,
      to,
    )!.n;
    try {
      return exactAggregate(
        Number(payments),
        -Number(expenses),
        Number(movements),
      );
    } catch {
      throw new DomainError("INVALID_MONEY");
    }
  }
  private cashSession(p: any) {
    return transaction(this.db, () => {
      if (p.action === "open") {
        assert(
          !this.row(
            "SELECT id FROM cash_sessions WHERE currency=? AND closed IS NULL",
            p.currency,
          ),
          "SESSION_OPEN",
        );
        const r = this.run(
          "INSERT INTO cash_sessions(user_id,currency,opening,opened) VALUES(?,?,?,?)",
          this.user!.id,
          p.currency,
          p.opening,
          now(),
        );
        this.audit("cash.open", String(r.lastInsertRowid));
        return Number(r.lastInsertRowid);
      }
      const session = this.row(
        "SELECT * FROM cash_sessions WHERE id=? AND closed IS NULL",
        p.id,
      );
      assert(
        session &&
          (session.user_id === this.user!.id ||
            managers.includes(this.user!.role)),
        "FORBIDDEN",
      );
      const expected = exactAggregate(
        session.opening,
        this.cashBalance(session.currency, session.opened),
      );
      this.run(
        "UPDATE cash_sessions SET closed=?,counted=?,expected=? WHERE id=?",
        now(),
        p.counted,
        expected,
        p.id,
      );
      this.audit("cash.close", String(p.id), { expected, counted: p.counted });
      return { expected, counted: p.counted, variance: p.counted - expected };
    });
  }
  invoice(id: number, kind: "sale" | "purchase" | "repair" = "sale"): Row {
    if (kind !== "sale") {
      this.require("receipt");
      const entity = this.row(
        kind === "purchase"
          ? "SELECT * FROM purchases WHERE id=?"
          : "SELECT * FROM repairs WHERE id=?",
        id,
      );
      assert(entity, "NOT_FOUND");
      const contact = this.row(
        "SELECT name FROM contacts WHERE id=?",
        entity.contact_id,
      );
      const original = this.row(
        "SELECT u.username FROM audit a JOIN users u ON u.id=a.actor WHERE a.action=? AND a.entity=? ORDER BY a.id LIMIT 1",
        kind === "purchase" ? "purchase.post" : "repair.create",
        String(id),
      );
      const phone =
        kind === "purchase"
          ? this.row("SELECT * FROM phones WHERE purchase_id=?", id)
          : null;
      const total =
        kind === "purchase"
          ? phone!.cost
          : entity.status === "Delivered"
            ? entity.final
            : entity.final || entity.estimate;
      const items =
        kind === "purchase"
          ? [
              {
                name: `${phone!.brand} ${phone!.model}`,
                identifier:
                  phone!.imei1 || phone!.alternate || phone!.imei2 || "",
                quantity: 1,
                price: entity.cost,
                warranty_days: 0,
                warranty_type: "none",
              },
              ...(phone!.cost > entity.cost
                ? [
                    {
                      nameKey: "refurbishment",
                      name: "",
                      identifier: "",
                      quantity: 1,
                      price: phone!.cost - entity.cost,
                      warranty_days: 0,
                      warranty_type: "none",
                    },
                  ]
                : []),
            ]
          : [
              {
                name: entity.device,
                identifier: entity.identifier,
                quantity: 1,
                price: total,
                warranty_days: entity.warranty_days,
                warranty_type: "shop",
              },
            ];
      return {
        typeKey: kind,
        currency: entity.currency,
        total,
        created: entity.created,
        status: entity.status,
        discount: 0,
        paid:
          kind === "purchase" ? this.purchasePaid(id) : this.paid("repair", id),
        invoice:
          kind === "purchase"
            ? `PUR-${String(id).padStart(6, "0")}`
            : entity.ticket,
        customer: contact?.name || "",
        cashier_name: original?.username || "",
        items,
        payments: this.rows(
          "SELECT * FROM payments WHERE target=? AND target_id=?",
          kind,
          id,
        ),
        settings: this.settings(),
      };
    }

    this.require("receipt");
    const sale = this.row(
      "SELECT s.*,u.username AS cashier_name,c.name AS customer FROM sales s JOIN users u ON u.id=s.cashier LEFT JOIN contacts c ON c.id=s.contact_id WHERE s.id=?",
      id,
    );
    assert(sale, "NOT_FOUND");
    return {
      ...sale,
      currency: sale.currency,
      returnedTotal: Number(
        this.row(
          "SELECT COALESCE(SUM(revenue),0) n FROM returns WHERE sale_id=?",
          id,
        )!.n,
      ),
      items: this.rows("SELECT * FROM sale_items WHERE sale_id=?", id),
      payments: this.rows(
        "SELECT * FROM payments WHERE target='sale' AND target_id=?",
        id,
      ),
      paid: this.paid("sale", id),
      settings: {
        ...this.settings(),
        ...Object.fromEntries(
          Object.entries(JSON.parse(sale.receipt_settings || "{}")).filter(
            ([key]) =>
              ["store", "phone", "address", "footer", "logo"].includes(key),
          ),
        ),
      },
    };
  }
  private snapshot(p: any) {
    const from = p.from ? `${p.from}T00:00:00.000Z` : "0000";
    const to = p.to ? `${p.to}T23:59:59.999Z` : "9999";
    assert(from <= to, "INVALID_DATES");
    const search = `%${p.search}%`;
    const offset = p.page * 50;
    const phones = this.rows(
      "SELECT * FROM phones WHERE brand LIKE ? OR model LIKE ? OR imei1 LIKE ? OR imei2 LIKE ? OR alternate LIKE ? OR inspection LIKE ? ORDER BY id DESC LIMIT 50 OFFSET ?",
      search,
      search,
      search,
      search,
      search,
      search,
      offset,
    );
    const accessories = this.rows(
      "SELECT * FROM accessories WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ? ORDER BY id DESC LIMIT 50 OFFSET ?",
      search,
      search,
      search,
      offset,
    );
    const contacts = this.rows(
      "SELECT * FROM contacts WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT 50 OFFSET ?",
      search,
      search,
      offset,
    );
    const sales = this.rows(
      "SELECT s.*,COALESCE((SELECT SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END) FROM payments WHERE target='sale' AND target_id=s.id),0) AS paid,COALESCE((SELECT SUM(revenue) FROM returns WHERE sale_id=s.id),0) AS returned_total FROM sales s WHERE created BETWEEN ? AND ? ORDER BY id DESC LIMIT 50 OFFSET ?",
      from,
      to,
      offset,
    );
    const purchases = this.rows(
      "SELECT p.*,COALESCE((SELECT SUM(CASE direction WHEN 'out' THEN amount ELSE -amount END) FROM payments WHERE target='purchase' AND target_id=p.id),0) AS total_paid,(SELECT cost FROM phones WHERE purchase_id=p.id) AS capitalized FROM purchases p WHERE created BETWEEN ? AND ? ORDER BY id DESC LIMIT 50 OFFSET ?",
      from,
      to,
      offset,
    );
    const reports = ["MMK", "THB", "USD"].map((currency) => {
      const sums = this.row(
        "SELECT COALESCE(SUM(total),0) revenue,COALESCE(SUM(cost),0) cogs,COUNT(*) sales FROM sales WHERE 1=1 AND currency=? AND created BETWEEN ? AND ?",
        currency,
        from,
        to,
      )!;
      const reversed = this.row(
        "SELECT COALESCE(SUM(revenue),0) revenue,COALESCE(SUM(cost),0) cost FROM returns WHERE currency=? AND created BETWEEN ? AND ?",
        currency,
        from,
        to,
      )!;
      sums.revenue -= Number(reversed.revenue);
      sums.cogs -= Number(reversed.cost);
      const expenses = this.row(
        "SELECT COALESCE(SUM(amount),0) n FROM expenses WHERE currency=? AND created BETWEEN ? AND ?",
        currency,
        from,
        to,
      )!.n;
      const repairRevenue = this.row(
        "SELECT COALESCE(SUM(final),0) n FROM repairs WHERE status='Delivered' AND currency=? AND delivered BETWEEN ? AND ?",
        currency,
        from,
        to,
      )!.n;
      const repairCost = this.row(
        "SELECT COALESCE(SUM(p.cost),0) n FROM repair_parts p JOIN repairs r ON r.id=p.repair_id WHERE r.status IN ('Delivered','Cancelled') AND r.currency=? AND COALESCE(r.closed_at,r.delivered) BETWEEN ? AND ?",
        currency,
        from,
        to,
      )!.n;
      const received = this.row(
        "SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END),0) n FROM payments WHERE target IN ('sale','repair') AND method!='Trade-in' AND currency=? AND created BETWEEN ? AND ?",
        currency,
        from,
        to,
      )!.n;
      const purchase = this.row(
        "SELECT (SELECT COALESCE(SUM(cost),0) FROM purchases WHERE currency=? AND created BETWEEN ? AND ?) - (SELECT COALESCE(SUM(p.cost),0) FROM purchases p JOIN audit a ON a.entity=CAST(p.id AS TEXT) AND a.action='purchase.reverse' WHERE p.currency=? AND a.created BETWEEN ? AND ?) - (SELECT COALESCE(SUM(p.cost),0) FROM purchases p JOIN trade_ins t ON t.purchase_id=p.id JOIN returns r ON r.sale_id=t.sale_id WHERE p.currency=? AND r.created BETWEEN ? AND ?) n",
        currency,
        from,
        to,
        currency,
        from,
        to,
        currency,
        from,
        to,
      )!.n;
      const receivable = this.row(
        "SELECT COALESCE(SUM(total-COALESCE((SELECT SUM(revenue) FROM returns WHERE sale_id=s.id AND created<=?),0)-COALESCE((SELECT SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END) FROM payments WHERE target='sale' AND target_id=s.id AND created<=?),0)),0) n FROM sales s WHERE currency=? AND created<=?",
        to,
        to,
        currency,
        to,
      )!.n;
      const payable = this.row(
        "SELECT COALESCE(SUM((SELECT cost FROM phones WHERE purchase_id=p.id)-COALESCE((SELECT SUM(CASE direction WHEN 'out' THEN amount ELSE -amount END) FROM payments WHERE target='purchase' AND target_id=p.id AND created<=?),0)),0) n FROM purchases p WHERE currency=? AND created<=? AND NOT EXISTS(SELECT 1 FROM audit a WHERE a.action='purchase.reverse' AND a.entity=CAST(p.id AS TEXT) AND a.created<=?) AND NOT EXISTS(SELECT 1 FROM trade_ins t JOIN returns r ON r.sale_id=t.sale_id WHERE t.purchase_id=p.id AND r.created<=?)",
        to,
        currency,
        to,
        to,
        to,
      )!.n;
      let gross: number, net: number;
      try {
        gross = exactAggregate(sums.revenue, -sums.cogs);
        net = exactAggregate(
          gross,
          Number(repairRevenue),
          -Number(repairCost),
          -Number(expenses),
        );
      } catch {
        throw new DomainError("INVALID_MONEY");
      }
      return {
        currency,
        ...sums,
        expenses,
        repairRevenue,
        repairCost,
        received,
        purchases: purchase,
        actualCollections: this.row(
          "SELECT COALESCE(SUM(CASE direction WHEN 'in' THEN original_amount ELSE -original_amount END),0) n FROM payments WHERE target IN ('sale','repair') AND method!='Trade-in' AND original_currency=? AND created BETWEEN ? AND ?",
          currency,
          from,
          to,
        )!.n,
        cashNet: this.cashBalance(currency, from, to),
        receivable,
        payable,
        gross,
        net,
      };
    });
    return {
      paymentMethods: this.rows(
        "SELECT * FROM payment_methods ORDER BY CASE WHEN name='Cash' THEN 0 ELSE 1 END,name",
      ),
      exchanges: this.rows(
        "SELECT * FROM exchanges ORDER BY created DESC LIMIT 50",
      ),
      photos: this.rows("SELECT * FROM photos ORDER BY id DESC LIMIT 50"),
      user: this.user,
      settings: this.settings(),
      phones,
      accessories,
      contacts,
      sales,
      purchases,
      reports,
      tradeIns: this.rows("SELECT * FROM trade_ins"),
      saleItems: this.rows(
        "SELECT si.*,s.currency FROM sale_items si JOIN sales s ON si.sale_id=s.id ORDER BY si.id DESC LIMIT 100",
      ),
      returns: this.rows("SELECT * FROM returns ORDER BY id DESC LIMIT 50"),
      inventory: this.row(
        "SELECT COUNT(*) n FROM phones WHERE status='available'",
      )!.n,
      lowStock: this.rows(
        "SELECT * FROM accessories WHERE quantity<=reorder ORDER BY id LIMIT 50",
      ),
      repairs: this.rows(
        "SELECT r.*,COALESCE((SELECT SUM(CASE direction WHEN 'in' THEN amount ELSE -amount END) FROM payments WHERE target='repair' AND target_id=r.id),0) paid FROM repairs r ORDER BY id DESC LIMIT 50 OFFSET ?",
        offset,
      ),
      warranties: this.rows(
        "SELECT si.*,s.invoice,s.created,s.currency FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE si.warranty_days>0 AND s.status='posted' ORDER BY s.id DESC LIMIT 50 OFFSET ?",
        offset,
      ),
      claims: this.rows(
        "SELECT * FROM warranty_claims ORDER BY id DESC LIMIT 50 OFFSET ?",
        offset,
      ),
      expenses: this.rows(
        "SELECT * FROM expenses WHERE created BETWEEN ? AND ? ORDER BY id DESC LIMIT 50 OFFSET ?",
        from,
        to,
        offset,
      ),
      payments: this.rows(
        "SELECT * FROM payments WHERE created BETWEEN ? AND ? ORDER BY id DESC LIMIT 50 OFFSET ?",
        from,
        to,
        offset,
      ),
      cashMovements: this.rows(
        "SELECT * FROM cash_movements ORDER BY id DESC LIMIT 50",
      ),
      cashSessions: this.rows(
        "SELECT * FROM cash_sessions ORDER BY id DESC LIMIT 50",
      ),
      users: managers.includes(this.user!.role)
        ? this.rows("SELECT id,username,role,active FROM users")
        : [],
      heldCarts: this.rows(
        "SELECT id,label,created FROM held_carts WHERE user_id=?",
        this.user!.id,
      ),
      rates: this.rows(
        "SELECT * FROM exchange_rates ORDER BY id DESC LIMIT 50",
      ),
      permissions: this.rows("SELECT * FROM permissions"),
      repairParts: this.rows(
        "SELECT * FROM repair_parts ORDER BY id DESC LIMIT 50",
      ),
      audit: managers.includes(this.user!.role)
        ? this.rows(
            "SELECT id,actor,action,entity,created FROM audit ORDER BY id DESC LIMIT 50 OFFSET ?",
            offset,
          )
        : [],
      page: p.page,
    };
  }
}
