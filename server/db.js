const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'ink_diary.db');

let sqlDb = null;

function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function substitute(sql, params) {
  let idx = 0;
  return sql.replace(/\?/g, () => {
    if (idx >= params.length) throw new Error('Missing param at index ' + idx + ' in: ' + sql.substring(0, 50));
    return escape(params[idx++]);
  });
}

function rowsFromExec(sql) {
  try {
    const result = sqlDb.exec(sql);
    if (!result.length || !result[0].columns.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  } catch (e) {
    console.error('[DB] Query error:', sql.substring(0, 100));
    throw e;
  }
}

function prepare(sql) {
  return {
    _sql: sql,
    get(...params) { return rowsFromExec(substitute(this._sql, params))[0] || null; },
    all(...params) { return rowsFromExec(substitute(this._sql, params)); },
    run(...params) {
      const replaced = substitute(this._sql, params);
      sqlDb.run(replaced);
      const idResult = sqlDb.exec('SELECT last_insert_rowid() as id');
      const lastId = idResult.length ? idResult[0].values[0][0] : 0;
      save();
      return { lastInsertRowid: lastId, changes: sqlDb.getRowsModified() };
    }
  };
}

function save() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Lazy getter — routes call getDB() at request time
function getDB() {
  return { prepare, exec: (s) => sqlDb.run(s) };
}

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      password TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood_key TEXT NOT NULL DEFAULT 'calm',
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      is_public INTEGER DEFAULT 1,
      date TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS entry_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, entry_id)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );
  `);

  // Migration: add email/phone columns for existing databases
  try { sqlDb.run('ALTER TABLE users ADD COLUMN email TEXT DEFAULT \'\''); } catch {}
  try { sqlDb.run('ALTER TABLE users ADD COLUMN phone TEXT DEFAULT \'\''); } catch {}

  save();
  console.log('[DB] Initialized');
}

// Periodic auto-save
setInterval(save, 10000);

module.exports = { init, getDB };
