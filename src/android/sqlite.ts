import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
let engine: SqlJsStatic;
let initial: Uint8Array | undefined;
export async function initializeSQLite(wasm: string | Uint8Array) {
  engine = await initSqlJs(
    typeof wasm === "string"
      ? { locateFile: () => wasm }
      : { wasmBinary: new Uint8Array(wasm).buffer },
  );
}
export function useDatabaseBytes(bytes?: Uint8Array) {
  initial = bytes;
}
function exactRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      if (typeof v === "bigint") {
        if (
          v > BigInt(Number.MAX_SAFE_INTEGER) ||
          v < BigInt(Number.MIN_SAFE_INTEGER)
        )
          throw new Error("INVALID_MONEY");
        return [k, Number(v)];
      }
      return [k, v];
    }),
  );
}
/** Node SQLite-compatible synchronous statements, backed by offline SQLite WASM. */
export class DatabaseSync {
  private database: Database;
  constructor(path: string) {
    if (path !== ":memory:" || !engine) throw new Error("INVALID_DATABASE");
    this.database = new engine.Database(initial);
    initial = undefined;
  }
  exec(sql: string) {
    this.database.exec(sql);
  }
  prepare(sql: string) {
    const read = (params: any[], single: boolean) => {
      const stmt = this.database.prepare(sql);
      try {
        stmt.bind(params);
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) {
          rows.push(
            exactRow((stmt as any).getAsObject(undefined, { useBigInt: true })),
          );
          if (single) break;
        }
        return single ? rows[0] : rows;
      } finally {
        stmt.free();
      }
    };
    return {
      get: (...params: any[]) => read(params, true),
      all: (...params: any[]) => read(params, false),
      run: (...params: any[]) => {
        this.database.run(sql, params);
        const changes = this.database.getRowsModified();
        const lastInsertRowid =
          this.database.exec("SELECT last_insert_rowid() id")[0]
            ?.values[0][0] ?? 0;
        return { changes, lastInsertRowid };
      },
    };
  }
  export() {
    const data = this.database.export();
    this.database.exec("PRAGMA foreign_keys=ON");
    return data;
  }
  close() {
    this.database.close();
  }
}
