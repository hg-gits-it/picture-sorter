import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');
const DB_PATH = resolve(DATA_DIR, 'picture-sorter.db');

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    tag TEXT CHECK(tag IN ('love','like','meh','tax_deduction','unrated')) DEFAULT 'unrated',
    group_position INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Migrate: if existing table has old CHECK constraint, recreate with current schema
const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='photos'").get();
if (tableInfo && (!tableInfo.sql.includes("'unrated'") || tableInfo.sql.includes("'hate'"))) {
  db.exec(`
    ALTER TABLE photos RENAME TO photos_old;
    CREATE TABLE photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      tag TEXT CHECK(tag IN ('love','like','meh','tax_deduction','unrated')) DEFAULT 'unrated',
      group_position INTEGER DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO photos SELECT id, filename,
      CASE WHEN tag = 'hate' THEN 'meh' WHEN tag IS NULL THEN 'unrated' ELSE tag END,
      group_position, created_at FROM photos_old;
    DROP TABLE photos_old;
  `);
}

// Migrate: add 'taken' column if missing
const tableInfo2 = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='photos'").get();
if (tableInfo2 && !tableInfo2.sql.includes('taken')) {
  db.exec(`ALTER TABLE photos ADD COLUMN taken INTEGER DEFAULT 0`);
}

// Migrate: add parsed metadata columns if missing
const tableInfo3 = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='photos'").get();
if (tableInfo3 && !tableInfo3.sql.includes('artist')) {
  db.exec(`ALTER TABLE photos ADD COLUMN number TEXT`);
  db.exec(`ALTER TABLE photos ADD COLUMN artist TEXT`);
  db.exec(`ALTER TABLE photos ADD COLUMN title TEXT`);
  db.exec(`ALTER TABLE photos ADD COLUMN medium TEXT`);
  db.exec(`ALTER TABLE photos ADD COLUMN dimensions TEXT`);
  db.exec(`ALTER TABLE photos ADD COLUMN flickr_id TEXT`);
}

// Migrate: convert any remaining NULL tags to 'unrated'
db.exec(`UPDATE photos SET tag = 'unrated' WHERE tag IS NULL`);

// Migrate: if filenames use old format (contain '--'), wipe all rows to force re-scan
const oldFormatRow = db.prepare("SELECT id FROM photos WHERE filename LIKE '%--%.%' LIMIT 1").get();
if (oldFormatRow) {
  db.exec('DELETE FROM photos');
}

export default db;
