import { DatabaseSync, backup } from "node:sqlite";
import { rmSync } from "node:fs";
import { openDatabase, SCHEMA_VERSION } from "./database";
import { DomainError } from "./errors";
export function validateBackup(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok")
      throw new DomainError("INVALID_BACKUP");
    const version = Number(
      db.prepare("PRAGMA user_version").get()?.user_version,
    );
    if (version < 1 || version > SCHEMA_VERSION)
      throw new DomainError("INVALID_BACKUP");
    for (const table of [
      "users",
      "settings",
      "phones",
      "sales",
      "purchases",
      "payments",
      "sale_items",
      "repairs",
      "audit",
      "contacts",
      "accessories",
    ])
      db.prepare(`SELECT * FROM ${table} LIMIT 0`).all();
    if (version === SCHEMA_VERSION)
      for (const table of [
        "owner_recovery",
        "auth_guard",
        "payment_refunds",
        "report_runs",
        "return_items",
        "cash_movements",
        "exchange_rates",
      ])
        db.prepare(`SELECT * FROM ${table} LIMIT 0`).all();
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw new DomainError("INVALID_BACKUP");
    return {
      version,
      sales: Number(db.prepare("SELECT COUNT(*) n FROM sales").get()!.n),
      phones: Number(db.prepare("SELECT COUNT(*) n FROM phones").get()!.n),
    };
  } finally {
    db.close();
  }
}
/** Upgrade an online-consistent copy, never the selected original backup. */
export async function prepareRestore(source: string, stage: string) {
  validateBackup(source);
  try {
    const db = new DatabaseSync(source, { readOnly: true });
    try {
      await backup(db, stage);
    } finally {
      db.close();
    }
    const migrated = openDatabase(stage);
    migrated.close();
    return validateBackup(stage);
  } catch (error) {
    rmSync(stage, { force: true });
    throw error;
  }
}
