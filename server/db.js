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

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    tag TEXT CHECK(tag IN ('love','like','meh','tax_deduction','unrated')) DEFAULT 'unrated',
    group_position INTEGER DEFAULT NULL,
    UNIQUE(user_id, photo_id)
  )
`);

// Prepared query helpers for common operations
const _getPhotoById = db.prepare('SELECT * FROM photos WHERE id = ?');
const _getPhotoFilenameById = db.prepare('SELECT filename FROM photos WHERE id = ?');

const _getUserPhoto = db.prepare(`
  SELECT p.id, p.filename, p.taken, p.show_id, p.artist, p.title,
         p.medium, p.dimensions, p.flickr_id, p.created_at,
         COALESCE(ur.tag, 'unrated') as tag, ur.group_position
  FROM photos p
  LEFT JOIN user_ratings ur ON ur.photo_id = p.id AND ur.user_id = ?
  WHERE p.id = ?
`);

export function getPhotoById(id) {
  return _getPhotoById.get(id);
}

export function getPhotoFilenameById(id) {
  return _getPhotoFilenameById.get(id);
}

export function getUserPhoto(userId, photoId) {
  return _getUserPhoto.get(userId, photoId);
}

export default db;
