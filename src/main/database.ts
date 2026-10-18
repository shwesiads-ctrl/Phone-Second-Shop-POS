import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export const SCHEMA_VERSION = 8;
export function openDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  const version = Number(
    (db.prepare("PRAGMA user_version").get() as any).user_version,
  );
  if (version > SCHEMA_VERSION) {
    db.close();
    throw new Error("DATABASE_NEWER");
  }
  try {
    if (version === 0)
      db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('Owner','Admin','Cashier','Stock Manager','Technician')),active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE contacts(id INTEGER PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL CHECK(kind IN ('customer','supplier')));
    CREATE TABLE purchases(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,contact_id INTEGER REFERENCES contacts(id),currency TEXT NOT NULL,cost INTEGER NOT NULL CHECK(cost>=0),paid INTEGER NOT NULL CHECK(paid>=0 AND paid<=cost),status TEXT NOT NULL DEFAULT 'posted',created TEXT NOT NULL);
    CREATE TABLE phones(id INTEGER PRIMARY KEY,purchase_id INTEGER NOT NULL REFERENCES purchases(id),brand TEXT NOT NULL,model TEXT NOT NULL,imei1 TEXT,imei2 TEXT,alternate TEXT,details TEXT NOT NULL,condition TEXT NOT NULL,grade TEXT NOT NULL,cost INTEGER NOT NULL CHECK(cost>=0),price INTEGER NOT NULL CHECK(price>=0),minimum INTEGER NOT NULL CHECK(minimum>=0),currency TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'available',created TEXT NOT NULL);
    CREATE TABLE identifiers(value TEXT PRIMARY KEY,phone_id INTEGER NOT NULL REFERENCES phones(id));
    CREATE TABLE accessories(id INTEGER PRIMARY KEY,sku TEXT NOT NULL UNIQUE,barcode TEXT NOT NULL DEFAULT '',name TEXT NOT NULL,category TEXT NOT NULL,cost INTEGER NOT NULL CHECK(cost>=0),price INTEGER NOT NULL CHECK(price>=0),currency TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),reorder INTEGER NOT NULL CHECK(reorder>=0));
    CREATE TABLE sales(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,invoice TEXT UNIQUE,contact_id INTEGER REFERENCES contacts(id),currency TEXT NOT NULL,total INTEGER NOT NULL CHECK(total>=0),discount INTEGER NOT NULL CHECK(discount>=0),cost INTEGER NOT NULL CHECK(cost>=0),status TEXT NOT NULL DEFAULT 'posted',cashier INTEGER NOT NULL REFERENCES users(id),created TEXT NOT NULL);
    CREATE TABLE sale_items(id INTEGER PRIMARY KEY,sale_id INTEGER NOT NULL REFERENCES sales(id),kind TEXT NOT NULL,product_id INTEGER NOT NULL,name TEXT NOT NULL,identifier TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),price INTEGER NOT NULL CHECK(price>=0),cost INTEGER NOT NULL CHECK(cost>=0),warranty_days INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE payments(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,target TEXT NOT NULL CHECK(target IN ('sale','purchase','repair')),target_id INTEGER NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),currency TEXT NOT NULL,method TEXT NOT NULL,direction TEXT NOT NULL CHECK(direction IN ('in','out')),created TEXT NOT NULL);
    CREATE TABLE stock_movements(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,product_id INTEGER NOT NULL,delta INTEGER NOT NULL,reason TEXT NOT NULL,reference TEXT NOT NULL,actor INTEGER REFERENCES users(id),created TEXT NOT NULL);
    CREATE TABLE returns(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,sale_id INTEGER NOT NULL UNIQUE REFERENCES sales(id),refund INTEGER NOT NULL,currency TEXT NOT NULL,reason TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE repairs(id INTEGER PRIMARY KEY,ticket TEXT UNIQUE,contact_id INTEGER NOT NULL REFERENCES contacts(id),device TEXT NOT NULL,identifier TEXT NOT NULL,problem TEXT NOT NULL,inspection TEXT NOT NULL,technician INTEGER REFERENCES users(id),status TEXT NOT NULL DEFAULT 'Received',diagnosis TEXT NOT NULL DEFAULT '',approved INTEGER NOT NULL DEFAULT 0,estimate INTEGER NOT NULL,final INTEGER NOT NULL DEFAULT 0,currency TEXT NOT NULL,warranty_days INTEGER NOT NULL DEFAULT 0,delivered TEXT,created TEXT NOT NULL);
    CREATE TABLE warranty_claims(id INTEGER PRIMARY KEY,sale_item INTEGER NOT NULL REFERENCES sale_items(id),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created TEXT NOT NULL);
    CREATE TABLE expenses(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,category TEXT NOT NULL,description TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),currency TEXT NOT NULL,method TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE cash_sessions(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),currency TEXT NOT NULL,opening INTEGER NOT NULL,opened TEXT NOT NULL,closed TEXT,counted INTEGER,expected INTEGER);
    CREATE UNIQUE INDEX one_open_session ON cash_sessions(user_id,currency) WHERE closed IS NULL;
    CREATE TABLE audit(id INTEGER PRIMARY KEY,actor INTEGER REFERENCES users(id),action TEXT NOT NULL,entity TEXT NOT NULL,details TEXT NOT NULL,created TEXT NOT NULL);
    PRAGMA user_version=1;
    COMMIT;`);
    if (version < 2)
      db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE permissions(user_id INTEGER NOT NULL REFERENCES users(id),operation TEXT NOT NULL,allowed INTEGER NOT NULL CHECK(allowed IN (0,1)),PRIMARY KEY(user_id,operation));
    CREATE TABLE repair_parts(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,repair_id INTEGER NOT NULL REFERENCES repairs(id),accessory_id INTEGER NOT NULL REFERENCES accessories(id),quantity INTEGER NOT NULL CHECK(quantity>0),cost INTEGER NOT NULL,currency TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE repair_events(id INTEGER PRIMARY KEY,repair_id INTEGER NOT NULL REFERENCES repairs(id),status TEXT NOT NULL,reason TEXT NOT NULL,actor INTEGER NOT NULL REFERENCES users(id),created TEXT NOT NULL);
    CREATE TABLE replenishments(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,accessory_id INTEGER NOT NULL REFERENCES accessories(id),contact_id INTEGER NOT NULL REFERENCES contacts(id),quantity INTEGER NOT NULL CHECK(quantity>0),unit_cost INTEGER NOT NULL,currency TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE exchange_rates(id INTEGER PRIMARY KEY,source_currency TEXT NOT NULL,target_currency TEXT NOT NULL,numerator INTEGER NOT NULL CHECK(numerator>0),denominator INTEGER NOT NULL CHECK(denominator>0),source TEXT NOT NULL,created TEXT NOT NULL,actor INTEGER NOT NULL REFERENCES users(id));
    CREATE TABLE held_carts(id INTEGER PRIMARY KEY,label TEXT NOT NULL,user_id INTEGER NOT NULL REFERENCES users(id),content TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE trade_ins(sale_id INTEGER PRIMARY KEY REFERENCES sales(id),purchase_id INTEGER NOT NULL UNIQUE REFERENCES purchases(id),credit INTEGER NOT NULL,currency TEXT NOT NULL);
    PRAGMA user_version=2;COMMIT;`);
    if (version < 3) {
      db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE returns RENAME TO legacy_returns;
      CREATE TABLE returns(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,sale_id INTEGER NOT NULL REFERENCES sales(id),refund INTEGER NOT NULL,revenue INTEGER NOT NULL,cost INTEGER NOT NULL,currency TEXT NOT NULL,reason TEXT NOT NULL,created TEXT NOT NULL);
      INSERT INTO returns SELECT r.id,r.request,r.sale_id,r.refund,s.total,s.cost,r.currency,r.reason,r.created FROM legacy_returns r JOIN sales s ON s.id=r.sale_id;
      CREATE TABLE return_items(id INTEGER PRIMARY KEY,return_id INTEGER NOT NULL REFERENCES returns(id),sale_item INTEGER NOT NULL REFERENCES sale_items(id),quantity INTEGER NOT NULL,restock INTEGER NOT NULL);
      INSERT INTO return_items(return_id,sale_item,quantity,restock) SELECT r.id,si.id,si.quantity,1 FROM legacy_returns r JOIN sale_items si ON si.sale_id=r.sale_id;
      DROP TABLE legacy_returns;
      PRAGMA user_version=3;COMMIT;`);
    }
    if (version < 4)
      db.exec(
        `BEGIN IMMEDIATE;CREATE TABLE photos(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,record_id INTEGER NOT NULL,content TEXT NOT NULL,created TEXT NOT NULL);PRAGMA user_version=4;COMMIT;`,
      );
    if (version < 5)
      db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE repairs ADD COLUMN original_repair INTEGER REFERENCES repairs(id);
    ALTER TABLE repairs ADD COLUMN closed_at TEXT;
    UPDATE repairs SET closed_at=delivered WHERE status='Delivered';
    ALTER TABLE warranty_claims RENAME TO legacy_claims;
    CREATE TABLE warranty_claims(id INTEGER PRIMARY KEY,sale_item INTEGER REFERENCES sale_items(id),repair_id INTEGER REFERENCES repairs(id),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',resolution TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,CHECK((sale_item IS NULL)!=(repair_id IS NULL)));
    INSERT INTO warranty_claims(id,sale_item,reason,status,created) SELECT id,sale_item,reason,status,created FROM legacy_claims;
    DROP TABLE legacy_claims;
    PRAGMA user_version=5;COMMIT;`);
    if (version < 6)
      db.exec(
        `BEGIN IMMEDIATE;ALTER TABLE phones ADD COLUMN inspection TEXT NOT NULL DEFAULT '{}';ALTER TABLE sale_items ADD COLUMN warranty_type TEXT NOT NULL DEFAULT 'shop';UPDATE sale_items SET warranty_type='none' WHERE warranty_days=0;ALTER TABLE sales ADD COLUMN receipt_settings TEXT NOT NULL DEFAULT '{}';PRAGMA user_version=6;COMMIT;`,
      );
    if (version < 7)
      db.exec(
        `BEGIN IMMEDIATE;CREATE TABLE cash_movements(id INTEGER PRIMARY KEY,request TEXT NOT NULL UNIQUE,direction TEXT NOT NULL CHECK(direction IN ('in','out')),amount INTEGER NOT NULL CHECK(amount>0),currency TEXT NOT NULL,reason TEXT NOT NULL,created TEXT NOT NULL,actor INTEGER NOT NULL REFERENCES users(id));PRAGMA user_version=7;COMMIT;`,
      );
    if (version < 8) {
      db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE exchange_rates ADD COLUMN basis TEXT NOT NULL DEFAULT 'minor';
      ALTER TABLE payments ADD COLUMN original_amount INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE payments ADD COLUMN original_currency TEXT NOT NULL DEFAULT 'MMK';
      ALTER TABLE payments ADD COLUMN fx TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE payments ADD COLUMN received_amount INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE payments ADD COLUMN change_amount INTEGER NOT NULL DEFAULT 0;
      UPDATE payments SET received_amount=amount;
      UPDATE payments SET original_amount=amount,original_currency=currency;
      ALTER TABLE sale_items ADD COLUMN fx TEXT NOT NULL DEFAULT '{}';
      CREATE TABLE payment_refunds(id INTEGER PRIMARY KEY,original_id INTEGER NOT NULL REFERENCES payments(id),refund_id INTEGER NOT NULL REFERENCES payments(id),amount INTEGER NOT NULL CHECK(amount>0),original_amount INTEGER NOT NULL CHECK(original_amount>=0));
      ALTER TABLE accessories ADD COLUMN wholesale INTEGER;ALTER TABLE repair_parts ADD COLUMN fx TEXT NOT NULL DEFAULT '{}';CREATE TABLE payment_methods(name TEXT PRIMARY KEY,active INTEGER NOT NULL CHECK(active IN (0,1)));INSERT INTO payment_methods VALUES('Cash',1),('KBZPay',1),('WavePay',1),('AYA Pay',1),('Bank transfer',1),('Other',1);CREATE TABLE exchanges(request TEXT PRIMARY KEY,original_sale INTEGER NOT NULL REFERENCES sales(id),return_id INTEGER NOT NULL REFERENCES returns(id),replacement_sale INTEGER NOT NULL REFERENCES sales(id),created TEXT NOT NULL);CREATE TABLE report_runs(id INTEGER PRIMARY KEY,currency TEXT NOT NULL,content TEXT NOT NULL,created TEXT NOT NULL,actor INTEGER NOT NULL REFERENCES users(id));
    `);
      // Attribute pre-FX legacy refunds before using the new allocation ledger.
      const groups = db
        .prepare("SELECT DISTINCT target,target_id FROM payments")
        .all() as any[];
      for (const group of groups) {
        const rows = db
          .prepare(
            "SELECT * FROM payments WHERE target=? AND target_id=? ORDER BY id",
          )
          .all(group.target, group.target_id) as any[];
        const originals: any[] = [];
        for (const row of rows) {
          if (row.direction === (group.target === "purchase" ? "out" : "in"))
            originals.push({ ...row, left: row.amount });
          else {
            let left = row.amount;
            for (const original of originals) {
              if (!left) break;
              const part = Math.min(left, original.left);
              if (part > 0) {
                db.prepare(
                  "INSERT INTO payment_refunds(original_id,refund_id,amount,original_amount) VALUES(?,?,?,?)",
                ).run(original.id, row.id, part, part);
                original.left -= part;
                left -= part;
              }
            }
            if (left) throw new Error("INVALID_LEGACY_PAYMENTS");
          }
        }
      }
      db.exec(`CREATE TRIGGER rates_immutable_update BEFORE UPDATE ON exchange_rates BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RATE');END;
      CREATE TRIGGER rates_immutable_delete BEFORE DELETE ON exchange_rates BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RATE');END;
      CREATE TRIGGER payments_immutable_update BEFORE UPDATE ON payments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYMENT');END;
      CREATE TRIGGER payments_immutable_delete BEFORE DELETE ON payments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYMENT');END;
      PRAGMA user_version=8;COMMIT;`);
    }
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    db.close();
    throw error;
  }
  return db;
}
export type DB = ReturnType<typeof openDatabase>;
const transactionDepth = new WeakMap<DB, number>();
export function transaction<T>(db: DB, fn: () => T): T {
  const depth = transactionDepth.get(db) ?? 0;
  const name = `nested_${depth}`;
  db.exec(depth ? `SAVEPOINT ${name}` : "BEGIN IMMEDIATE");
  transactionDepth.set(db, depth + 1);
  try {
    const result = fn();
    db.exec(depth ? `RELEASE SAVEPOINT ${name}` : "COMMIT");
    return result;
  } catch (error) {
    db.exec(depth ? `ROLLBACK TO SAVEPOINT ${name}` : "ROLLBACK");
    if (depth) db.exec(`RELEASE SAVEPOINT ${name}`);
    throw error;
  } finally {
    transactionDepth.set(db, depth);
  }
}
