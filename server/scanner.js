import { readdirSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { resolve, dirname, extname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import db from './db.js';
import { parseFlickrMeta } from './utils/parseFlickrMeta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const DOWNLOAD_DIR = resolve(PROJECT_ROOT, '.flickr-download');
const THUMBNAILS_DIR = resolve(PROJECT_ROOT, 'data', 'thumbnails');

mkdirSync(THUMBNAILS_DIR, { recursive: true });

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

/**
 * Recursively find all image files under a directory.
 * Returns array of absolute paths.
 */
function findImageFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findImageFiles(full));
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

export async function scanPhotos() {
  const imageFiles = findImageFiles(DOWNLOAD_DIR);

  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO photos (filename) VALUES (?)'
  );
  const updateMetaStmt = db.prepare(
    'UPDATE photos SET number=?, artist=?, title=?, medium=?, dimensions=?, flickr_id=? WHERE filename=? AND artist IS NULL'
  );

  const insertMany = db.transaction((files) => {
    for (const absPath of files) {
      const relPath = relative(PROJECT_ROOT, absPath);
      const sidecarPath = absPath + '.json';

      insertStmt.run(relPath);

      if (existsSync(sidecarPath)) {
        try {
          const meta = JSON.parse(readFileSync(sidecarPath, 'utf8'));
          const parsed = parseFlickrMeta(meta.title);
          const flickrId = meta.id ? String(meta.id) : null;
          updateMetaStmt.run(
            parsed.number, parsed.artist, parsed.title,
            parsed.medium, parsed.dimensions, flickrId, relPath
          );
        } catch (err) {
          console.error(`Failed to parse sidecar for ${relPath}:`, err.message);
        }
      }
    }
  });

  insertMany(imageFiles);

  // Generate thumbnails keyed by flickr_id
  const photosWithFlickrId = db.prepare(
    'SELECT filename, flickr_id FROM photos WHERE flickr_id IS NOT NULL'
  ).all();

  for (const photo of photosWithFlickrId) {
    const thumbName = `${photo.flickr_id}.jpg`;
    const thumbPath = resolve(THUMBNAILS_DIR, thumbName);
    if (!existsSync(thumbPath)) {
      try {
        await sharp(resolve(PROJECT_ROOT, photo.filename))
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
      } catch (err) {
        console.error(`Failed to generate thumbnail for ${photo.filename}:`, err.message);
      }
    }
  }

  // Also generate thumbnails for photos without flickr_id (fallback to filename-based)
  const photosWithoutFlickrId = db.prepare(
    'SELECT filename FROM photos WHERE flickr_id IS NULL'
  ).all();

  for (const photo of photosWithoutFlickrId) {
    const thumbName = photo.filename.replace(/[/\\]/g, '_');
    const thumbPath = resolve(THUMBNAILS_DIR, thumbName);
    if (!existsSync(thumbPath)) {
      try {
        await sharp(resolve(PROJECT_ROOT, photo.filename))
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
      } catch (err) {
        console.error(`Failed to generate thumbnail for ${photo.filename}:`, err.message);
      }
    }
  }

  // Remove orphaned DB entries (files no longer on disk)
  const relPaths = new Set(imageFiles.map(f => relative(PROJECT_ROOT, f)));
  const dbPhotos = db.prepare('SELECT id, filename, flickr_id FROM photos').all();
  const deleteStmt = db.prepare('DELETE FROM photos WHERE id = ?');

  const removeOrphans = db.transaction(() => {
    for (const photo of dbPhotos) {
      if (!relPaths.has(photo.filename)) {
        deleteStmt.run(photo.id);
        // Remove orphaned thumbnail
        if (photo.flickr_id) {
          const thumbPath = resolve(THUMBNAILS_DIR, `${photo.flickr_id}.jpg`);
          if (existsSync(thumbPath)) unlinkSync(thumbPath);
        }
      }
    }
  });

  removeOrphans();

  return { scanned: imageFiles.length };
}
