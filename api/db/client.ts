import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrations } from "./migrations";

export type DB = Database.Database;

let instance: DB | null = null;

export function dbPath(): string {
  const p = process.env.IDR_DB_PATH ?? path.join(process.cwd(), "data", "idr.db");
  if (p === ":memory:") return p;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

export function openDb(file = dbPath()): DB {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function migrate(db: DB) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)`);
  const applied = new Set(
    db.prepare(`SELECT id FROM schema_migrations`).all().map((r) => (r as { id: number }).id),
  );
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare(`INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)`).run(m.id, m.name, Date.now());
    })();
  }
}

/** Process-wide singleton. In tests pass IDR_DB_PATH=:memory: or call openDb directly. */
export function getDb(): DB {
  if (!instance) instance = openDb();
  return instance;
}

export function resetDbForTests() {
  instance?.close();
  instance = null;
}

export function isSeeded(db: DB): boolean {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM agents`).get() as { c: number };
  return row.c > 0;
}
