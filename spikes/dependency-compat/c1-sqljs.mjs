import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import initSqlJs from "sql.js";

const DEFAULT_DB_PATH = join(homedir(), ".gtd-outlook", "classification-cache.db");
const DB_PATH =
  process.env.C1_DB_PATH?.trim() || join(process.cwd(), ".tmp", "classification-cache.db");

function ensureDir(path) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

const SQL = await initSqlJs({});
const db = new SQL.Database();

db.run(`
  CREATE TABLE IF NOT EXISTS classification_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_hash TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

db.run(
  "INSERT OR REPLACE INTO classification_cache (content_hash, category, created_at) VALUES (?, ?, ?)",
  ["hash-c1-test", "@Action", new Date().toISOString()],
);

ensureDir(DB_PATH);
const bytes = db.export();
writeFileSync(DB_PATH, bytes);
db.close();

const reloadedBytes = readFileSync(DB_PATH);
const dbReloaded = new SQL.Database(reloadedBytes);
const result = dbReloaded.exec(
  "SELECT content_hash, category FROM classification_cache WHERE content_hash = 'hash-c1-test'",
);
dbReloaded.close();

const rowCount = result[0]?.values?.length ?? 0;
const row = rowCount > 0 ? result[0].values[0] : null;

console.log(
  JSON.stringify(
    {
      defaultDbPath: DEFAULT_DB_PATH,
      dbPath: DB_PATH,
      rowCount,
      row: row
        ? {
            contentHash: row[0],
            category: row[1],
          }
        : null,
    },
    null,
    2,
  ),
);

if (rowCount !== 1) {
  throw new Error(`Expected 1 persisted row, got ${rowCount}`);
}
