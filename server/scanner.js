import { readdirSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import sharp from 'sharp';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = resolve(__dirname, '..', 'photos');
const THUMBNAILS_DIR = resolve(__dirname, '..', 'data', 'thumbnails');

mkdirSync(THUMBNAILS_DIR, { recursive: true });

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

export async function scanPhotos() {
  const files = readdirSync(PHOTOS_DIR).filter(f => {
    const ext = extname(f).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  });

  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO photos (filename) VALUES (?)'
  );

  const insertMany = db.transaction((filenames) => {
    for (const filename of filenames) {
      insertStmt.run(filename);
    }
  });

  insertMany(files);

  // Generate thumbnails for files that don't have one yet
  for (const filename of files) {
    const thumbPath = resolve(THUMBNAILS_DIR, filename);
    if (!existsSync(thumbPath)) {
      try {
        await sharp(resolve(PHOTOS_DIR, filename))
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
      } catch (err) {
        console.error(`Failed to generate thumbnail for ${filename}:`, err.message);
      }
    }
  }

  // Remove orphaned DB entries (files no longer on disk)
  const fileSet = new Set(files);
  const dbPhotos = db.prepare('SELECT id, filename FROM photos').all();
  const deleteStmt = db.prepare('DELETE FROM photos WHERE id = ?');

  const removeOrphans = db.transaction(() => {
    for (const photo of dbPhotos) {
      if (!fileSet.has(photo.filename)) {
        deleteStmt.run(photo.id);
        // Remove orphaned thumbnail too
        const thumbPath = resolve(THUMBNAILS_DIR, photo.filename);
        if (existsSync(thumbPath)) {
          unlinkSync(thumbPath);
        }
      }
    }
  });

  removeOrphans();

  return { scanned: files.length };
}
