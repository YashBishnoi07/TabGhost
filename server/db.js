// db.js — SQLite setup via sql.js (pure WebAssembly, no native build required)
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'tabghost.db');

let _db = null;
let _SQL = null;

/**
 * Lazily initialize sql.js and load (or create) the database file.
 */
async function getDb() {
  if (_db) return _db;

  if (!_SQL) {
    const initSqlJs = require('sql.js');
    _SQL = await initSqlJs();
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(fileBuffer);
  } else {
    _db = new _SQL.Database();
  }

  // Create digests table if it doesn't exist
  _db.run(`
    CREATE TABLE IF NOT EXISTS digests (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      email   TEXT    NOT NULL,
      tabs    TEXT    NOT NULL,
      sent_at TEXT    NOT NULL
    )
  `);

  // Persist the initial empty DB to disk
  persist();

  return _db;
}

/**
 * Write current in-memory DB to disk.
 */
function persist() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Save a digest record.
 * @param {string} email
 * @param {Array}  tabs
 * @returns {{ lastInsertRowid: number }}
 */
async function saveDigest(email, tabs) {
  const db = await getDb();
  db.run(
    'INSERT INTO digests (email, tabs, sent_at) VALUES (?, ?, ?)',
    [email, JSON.stringify(tabs), new Date().toISOString()]
  );

  // Get last inserted row id
  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = result[0]?.values[0]?.[0] ?? 0;

  persist();
  return { lastInsertRowid };
}

/**
 * Retrieve all digest records (newest first).
 */
async function getAllDigests() {
  const db = await getDb();
  const result = db.exec(
    'SELECT id, email, tabs, sent_at FROM digests ORDER BY sent_at DESC'
  );
  if (!result[0]) return [];
  const [{ columns, values }] = result;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

module.exports = { saveDigest, getAllDigests };
