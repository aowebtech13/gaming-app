import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { consoleLog } from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const configuredPath = process.env.DB_PATH
  || process.env.SQLITE_DB_PATH
  || process.env.DB_FILE
  || 'data/arcade.sqlite';
const isMemoryDatabase = configuredPath === ':memory:';
const dbPath = isMemoryDatabase
  ? ':memory:'
  : (path.isAbsolute(configuredPath) ? configuredPath : path.join(rootDir, configuredPath));

if (!isMemoryDatabase) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma(`busy_timeout = ${parseInt(process.env.DB_BUSY_TIMEOUT) || 5000}`);

let closed = false;
let transactionDepth = 0;

const normalizeParams = (params) => {
  if (params === undefined || params === null) return [];
  return Array.isArray(params) ? params : [params];
};

const toWriteResult = (result) => ({
  changes: result.changes,
  affectedRows: result.changes,
  changedRows: result.changes,
  insertId: Number(result.lastInsertRowid) || 0
});

/**
 * Convert the small MySQL dialect surface used by the application to SQLite.
 * Migration files use native SQLite SQL; this keeps legacy model queries working
 * during the database migration.
 */
const normalizeSQL = (query) => {
  let sql = String(query || '').trim();

  sql = sql
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bCURDATE\(\)/gi, "DATE('now')")
    .replace(/\bRAND\(\)/gi, 'RANDOM()')
    .replace(/\bINSERT\s+IGNORE\b/gi, 'INSERT OR IGNORE')
    .replace(/\bTRUNCATE\s+TABLE\s+(`?)([A-Za-z0-9_]+)\1/gi, 'DELETE FROM $2')
    .replace(/\bDATABASE\(\)/gi, "'main'")
    .replace(/\bDATE_SUB\(\s*([^,]+?),\s*INTERVAL\s+(\?|[-+]?\d+(?:\.\d+)?)\s+(DAY|DAYS|HOUR|HOURS|MINUTE|MINUTES|SECOND|SECONDS|MONTH|MONTHS|YEAR|YEARS)\s*\)/gi,
      (match, expression, amount, unit) => {
        const normalizedUnit = unit.toLowerCase().replace(/s$/, '');
        const plural = normalizedUnit === 'day' || normalizedUnit === 'hour' || normalizedUnit === 'minute' || normalizedUnit === 'second' || normalizedUnit === 'month' || normalizedUnit === 'year'
          ? `${normalizedUnit}s`
          : normalizedUnit;
        if (amount === '?') {
          return `datetime(${expression.trim()}, '-' || ? || ' ${plural}')`;
        }
        const sign = amount.startsWith('-') ? '+' : '-';
        const value = amount.replace(/^[+-]/, '');
        return `datetime(${expression.trim()}, '${sign}${value} ${plural}')`;
      })
    .replace(/\s+COLLATE\s+[A-Za-z0-9_]+/gi, '')
    .replace(/\s+ENGINE\s*=\s*[A-Za-z0-9_]+/gi, '')
    .replace(/\s+DEFAULT\s+CHARSET\s*=\s*[A-Za-z0-9_]+/gi, '')
    .replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '')
    .replace(/\bAUTO_INCREMENT\b/gi, 'AUTOINCREMENT')
    .replace(/\bBIGINT\(\d+\)/gi, 'INTEGER')
    .replace(/\bINT\(\d+\)/gi, 'INTEGER')
    .replace(/\bTINYINT\(\d+\)/gi, 'INTEGER')
    .replace(/\b(?:TINYTEXT|MEDIUMTEXT|LONGTEXT)\b/gi, 'TEXT')
    .replace(/\bDATETIME\b/gi, 'TEXT')
    .replace(/\bDATE\b/gi, 'TEXT')
    .replace(/\bTIME\b/gi, 'TEXT')
    .replace(/DROP\s+INDEX\s+(IF\s+EXISTS\s+)?([A-Za-z0-9_]+)\s+ON\s+([A-Za-z0-9_]+)/gi, 'DROP INDEX $1$2')
    .replace(/(\b(?:CREATE|UNIQUE\s+CREATE)\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[A-Za-z0-9_]+\s+ON\s+[A-Za-z0-9_]+\s*\([^)]*?)\(\d+\)/gi, '$1');

  return sql;
};

const executeShowTables = (query) => {
  const likeMatch = query.match(/LIKE\s+["']?([A-Za-z0-9_]+)["']?/i);
  const rows = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      ${likeMatch ? "AND name LIKE ? ESCAPE '\\'" : ''}
    ORDER BY name
  `).all(...(likeMatch ? [likeMatch[1].replace(/[%_]/g, '\\$&') + '%'] : []));

  const key = 'Tables_in_arcade';
  return [rows.map((row) => ({ [key]: row.name, table_name: row.name }))];
};

const executeShowCreateTable = (query) => {
  const match = query.match(/SHOW\s+CREATE\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i);
  const row = match
    ? db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(match[1])
    : null;
  return [{ 'Create Table': row?.sql || null }];
};

const executeSpecial = (query) => {
  const trimmed = query.trim();

  if (/^SET\s+(NAMES|time_zone|sql_mode)\b/i.test(trimmed)) {
    return [{}];
  }

  if (/^SET\s+foreign_key_checks\s*=\s*([01])/i.test(trimmed)) {
    // SQLite migration code uses this MySQL compatibility statement. Foreign
    // keys are enabled for the connection; toggling it inside a transaction is
    // not permitted by SQLite, so treat it as a compatibility no-op there.
    if (transactionDepth === 0) {
      const enabled = /^SET\s+foreign_key_checks\s*=\s*1/i.test(trimmed) ? 'ON' : 'OFF';
      db.pragma(`foreign_keys = ${enabled}`);
    }
    return [{}];
  }

  if (/^SHOW\s+TABLES\b/i.test(trimmed)) {
    return executeShowTables(trimmed);
  }

  if (/^SHOW\s+CREATE\s+TABLE\b/i.test(trimmed)) {
    return executeShowCreateTable(trimmed);
  }

  if (/^OPTIMIZE\s+TABLE\b/i.test(trimmed)) {
    db.exec('VACUUM');
    return [{}];
  }

  return null;
};

const isReadStatement = (statement) => statement.reader;

/**
 * Execute a query using the same result shape as mysql2/promise.
 * SELECT statements return an array of rows. Writes return a result object with
 * affectedRows and insertId so existing models can remain unchanged.
 */
const execute = async (query, params) => {
  if (closed) throw new Error('SQLite database is closed');

  const normalized = normalizeSQL(query);
  const specialResult = executeSpecial(normalized);
  if (specialResult !== null) return specialResult;

  const statement = db.prepare(normalized);
  const bindings = normalizeParams(params);

  if (isReadStatement(statement)) {
    return statement.all(...bindings);
  }

  return toWriteResult(statement.run(...bindings));
};

const beginTransaction = async () => {
  if (transactionDepth === 0) db.exec('BEGIN');
  transactionDepth += 1;
};

const commit = async () => {
  if (transactionDepth === 0) return;
  transactionDepth -= 1;
  if (transactionDepth === 0) db.exec('COMMIT');
};

const rollback = async () => {
  if (transactionDepth === 0) return;
  transactionDepth = 0;
  db.exec('ROLLBACK');
};

const createConnection = async () => ({
  execute,
  query: execute,
  beginTransaction,
  commit,
  rollback,
  end: async () => {}
});

const closePool = async () => {
  if (closed) return;
  try {
    closed = true;
    db.close();
    consoleLog('database', 'SQLite database closed gracefully');
  } catch (error) {
    consoleLog('error', 'Error closing SQLite database: ' + JSON.stringify(error));
  }
};

const getDatabase = () => db;
const getDatabasePath = () => dbPath;

export default execute;
export {
  closePool,
  createConnection,
  db,
  execute,
  getDatabase,
  getDatabasePath,
  normalizeSQL,
  createConnection as pool
};
