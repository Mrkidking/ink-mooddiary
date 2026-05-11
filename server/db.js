const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_URL || '';
const TURSO_TOKEN = process.env.TURSO_TOKEN || '';

let turso = null;

function getDB() {
  if (!turso) throw new Error('DB not initialized');

  // Return a wrapper with the same .prepare().get/all/run() API
  return {
    prepare(sql) {
      return {
        async get(...params) {
          const result = await turso.execute({ sql, args: params });
          return result.rows[0] || null;
        },
        async all(...params) {
          const result = await turso.execute({ sql, args: params });
          return result.rows;
        },
        async run(...params) {
          const result = await turso.execute({ sql, args: params });
          return { lastInsertRowid: Number(result.lastInsertRowid) || 0, changes: result.rowsAffected };
        }
      };
    }
  };
}

async function init() {
  if (!TURSO_URL) {
    console.log('[DB] TURSO_URL not set — using local sql.js fallback');
    return initLocal();
  }

  turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  console.log('[DB] Connected to Turso');

  // Create tables
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      password TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await turso.execute(`
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
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS entry_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, entry_id)
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    )
  `);

  console.log('[DB] Turso tables initialized');
}

// Local sql.js fallback (development only)
async function initLocal() {
  const initSqlJs = require('sql.js');
  const fs = require('fs');
  const path = require('path');
  const DB_PATH = path.join(__dirname, '..', 'ink_diary.db');
  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqlDb = new SQL.Database();
  }

  function escape(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    return "'" + String(val).replace(/'/g, "''") + "'";
  }
  function substitute(sql, params) {
    let idx = 0;
    return sql.replace(/\?/g, () => escape(params[idx++]));
  }
  function rowsFromExec(s) {
    const r = sqlDb.exec(s);
    if (!r.length || !r[0].columns.length) return [];
    const { columns, values } = r[0];
    return values.map(row => { const o = {}; columns.forEach((c, i) => o[c] = row[i]); return o; });
  }

  turso = {
    execute({ sql, args }) {
      const rows = rowsFromExec(substitute(sql, args));
      return { rows, lastInsertRowid: 0, rowsAffected: 0 };
    }
  };

  // Create tables for local
  sqlDb.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, phone TEXT DEFAULT '', password TEXT NOT NULL, display_name TEXT DEFAULT '', bio TEXT DEFAULT '', avatar_url TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  sqlDb.run(`CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, mood_key TEXT NOT NULL DEFAULT 'calm', title TEXT DEFAULT '', content TEXT DEFAULT '', is_public INTEGER DEFAULT 1, date TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  sqlDb.run(`CREATE TABLE IF NOT EXISTS entry_images (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER NOT NULL, image_url TEXT NOT NULL, sort_order INTEGER DEFAULT 0)`);
  sqlDb.run(`CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, entry_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, entry_id))`);
  sqlDb.run(`CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, entry_id INTEGER NOT NULL, content TEXT NOT NULL, image_url TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  sqlDb.run(`CREATE TABLE IF NOT EXISTS follows (id INTEGER PRIMARY KEY AUTOINCREMENT, follower_id INTEGER NOT NULL, following_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(follower_id, following_id))`);

  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('[DB] Local sql.js initialized');
}

module.exports = { init, getDB };
