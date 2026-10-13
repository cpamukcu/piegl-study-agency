// Server-only: the one place that opens the SQLite database. Never import from a client component.
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { MIGRATIONS } from "@/db/schema";
import { ensureDataDir, getDataDir } from "@/lib/data-dir";

export type Db = DatabaseSync;

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function all<T>(db: Db, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function one<T>(db: Db, sql: string, ...params: SQLInputValue[]): T | null {
  return (db.prepare(sql).get(...params) as unknown as T | undefined) ?? null;
}

export function migrate(db: Db): void {
  const current = one<{ user_version: number }>(db, "PRAGMA user_version")?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

export function openDb(file: string): Db {
  const inMemory = file === ":memory:";
  const isNew = !inMemory && !existsSync(file);
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  if (!inMemory) db.exec("PRAGMA journal_mode = WAL");
  if (isNew) chmodSync(file, 0o600);
  migrate(db);
  return db;
}

// Kept on globalThis so dev-server reloads reuse the open connection.
const cache = globalThis as typeof globalThis & { __psaDbs?: Map<string, Db> };

export function getDb(): Db {
  const file = path.join(ensureDataDir(getDataDir()), "study.db");
  cache.__psaDbs ??= new Map();
  let db = cache.__psaDbs.get(file);
  if (!db) {
    db = openDb(file);
    cache.__psaDbs.set(file, db);
  }
  return db;
}
