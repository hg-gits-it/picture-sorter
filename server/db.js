import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '..', 'data', 'picture-sorter.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    tag TEXT CHECK(tag IN ('love','like','meh','tax_deduction','unrated')) DEFAULT 'unrated',
    group_position INTEGER DEFAULT NULL,
    taken INTEGER DEFAULT 0,
    show_id TEXT,
    artist TEXT,
    title TEXT,
    medium TEXT,
    dimensions TEXT,
    flickr_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Prepared query helpers for common operations
const _getPhotoById = db.prepare('SELECT * FROM photos WHERE id = ?');
const _getPhotoFilenameById = db.prepare('SELECT filename FROM photos WHERE id = ?');

export function getPhotoById(id) {
  return _getPhotoById.get(id);
}

export function getPhotoFilenameById(id) {
  return _getPhotoFilenameById.get(id);
}

export default db;
