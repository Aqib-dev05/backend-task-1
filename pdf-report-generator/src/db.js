// src/db.js
// One small SQLite database file holds BOTH the business data (orders)
// and the report bookkeeping (reports). Artifacts (PDFs) live on disk.
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'report.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// --- Business data: the little shop -------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    customer   TEXT NOT NULL,
    product    TEXT NOT NULL,
    amount     REAL NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// --- Report bookkeeping: one row per generated PDF ----------------
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    path       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

module.exports = { db, DB_PATH };
