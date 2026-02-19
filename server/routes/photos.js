import { Router } from 'express';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = resolve(__dirname, '..', '..', 'photos');

const router = Router();

// Helper: count photos in groups with higher priority than the given tag
function higherGroupCount(tag) {
  const priority = { love: 0, like: 1, meh: 2, tax_deduction: 3 };
  const p = priority[tag];
  if (p === 0) return 0;
  const higherTags = Object.entries(priority)
    .filter(([, v]) => v < p)
    .map(([k]) => k);
  const placeholders = higherTags.map(() => '?').join(',');
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM photos WHERE tag IN (${placeholders})`
  ).get(...higherTags);
  return row.cnt;
}

// GET /api/photos — list photos with computed global rank
router.get('/', (req, res) => {
  const { tag, search, hideClaimed, sort } = req.query;

  let where = [];
  let params = [];

  if (tag === 'unrated') {
    where.push('tag IS NULL');
  } else if (tag) {
    where.push('tag = ?');
    params.push(tag);
  }

  if (search) {
    where.push('filename LIKE ?');
    params.push(`%${search}%`);
  }

  if (hideClaimed === '1') {
    where.push('taken = 0');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Compute global rank using window functions
  // Priority: love=1, like=2, meh=3, tax_deduction=4, null=5
  const orderBy = sort === 'number'
    ? `ORDER BY CAST(substr(filename, 1, instr(filename, '--') - 1) AS INTEGER)`
    : `ORDER BY
      CASE WHEN tag IS NULL THEN 1 ELSE 0 END,
      CASE tag WHEN 'love' THEN 1 WHEN 'like' THEN 2 WHEN 'meh' THEN 3 WHEN 'tax_deduction' THEN 4 ELSE 5 END,
      group_position,
      filename`;

  const sql = `
    SELECT *,
      CASE
        WHEN tag IS NOT NULL AND group_position IS NOT NULL THEN
          (SELECT COUNT(*) FROM photos p2
           WHERE p2.tag IS NOT NULL
             AND p2.group_position IS NOT NULL
             AND (
               CASE p2.tag WHEN 'love' THEN 1 WHEN 'like' THEN 2 WHEN 'meh' THEN 3 WHEN 'tax_deduction' THEN 4 END
               < CASE photos.tag WHEN 'love' THEN 1 WHEN 'like' THEN 2 WHEN 'meh' THEN 3 WHEN 'tax_deduction' THEN 4 END
             )
          ) + group_position
        ELSE NULL
      END as global_rank
    FROM photos
    ${whereClause}
    ${orderBy}
  `;

  const photos = db.prepare(sql).all(...params);

  // Also return counts for filter badges
  const countsWhere = hideClaimed === '1' ? 'WHERE taken = 0' : '';
  const counts = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN tag = 'love' THEN 1 ELSE 0 END), 0) as love,
      COALESCE(SUM(CASE WHEN tag = 'like' THEN 1 ELSE 0 END), 0) as 'like',
      COALESCE(SUM(CASE WHEN tag = 'meh' THEN 1 ELSE 0 END), 0) as meh,
      COALESCE(SUM(CASE WHEN tag = 'tax_deduction' THEN 1 ELSE 0 END), 0) as tax_deduction,
      COALESCE(SUM(CASE WHEN tag IS NULL THEN 1 ELSE 0 END), 0) as unrated
    FROM photos ${countsWhere}
  `).get();

  res.json({ photos, counts });
});

// PATCH /api/photos/:id/tag — set or clear tag
router.patch('/:id/tag', (req, res) => {
  const { id } = req.params;
  const { tag } = req.body; // null to clear, or 'love'/'like'/'meh'/'tax_deduction'

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const validTags = ['love', 'like', 'meh', 'tax_deduction', null];
  if (!validTags.includes(tag)) {
    return res.status(400).json({ error: 'Invalid tag' });
  }

  const updateTag = db.transaction(() => {
    const oldTag = photo.tag;
    const oldPosition = photo.group_position;

    if (tag === oldTag) return; // No change

    // Remove from old group and recompact
    if (oldTag && oldPosition != null) {
      db.prepare(`
        UPDATE photos SET group_position = group_position - 1
        WHERE tag = ? AND group_position > ?
      `).run(oldTag, oldPosition);
    }

    if (tag) {
      const priority = { love: 1, like: 2, meh: 3, tax_deduction: 4 };
      const demoting = oldTag && priority[oldTag] < priority[tag];

      let newPosition;
      if (demoting) {
        // Demoting (higher → lower priority): insert at top
        db.prepare(`
          UPDATE photos SET group_position = group_position + 1
          WHERE tag = ?
        `).run(tag);
        newPosition = 1;
      } else {
        // Promoting or newly rated: append to bottom
        const maxPos = db.prepare(
          'SELECT COALESCE(MAX(group_position), 0) as max_pos FROM photos WHERE tag = ?'
        ).get(tag);
        newPosition = maxPos.max_pos + 1;
      }

      db.prepare('UPDATE photos SET tag = ?, group_position = ? WHERE id = ?')
        .run(tag, newPosition, id);
    } else {
      // Clear tag
      db.prepare('UPDATE photos SET tag = NULL, group_position = NULL WHERE id = ?')
        .run(id);
    }
  });

  updateTag();

  const updated = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  res.json(updated);
});

// PATCH /api/photos/:id/reorder — move photo within its tag group
router.patch('/:id/reorder', (req, res) => {
  const { id } = req.params;
  const { newPosition } = req.body;

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  if (!photo.tag) return res.status(400).json({ error: 'Cannot reorder unrated photo' });

  const oldPosition = photo.group_position;
  if (oldPosition === newPosition) return res.json(photo);

  const reorder = db.transaction(() => {
    if (newPosition > oldPosition) {
      // Moving down: shift items between old+1..new up by 1
      db.prepare(`
        UPDATE photos SET group_position = group_position - 1
        WHERE tag = ? AND group_position > ? AND group_position <= ?
      `).run(photo.tag, oldPosition, newPosition);
    } else {
      // Moving up: shift items between new..old-1 down by 1
      db.prepare(`
        UPDATE photos SET group_position = group_position + 1
        WHERE tag = ? AND group_position >= ? AND group_position < ?
      `).run(photo.tag, newPosition, oldPosition);
    }

    db.prepare('UPDATE photos SET group_position = ? WHERE id = ?')
      .run(newPosition, id);
  });

  reorder();

  const updated = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  res.json(updated);
});

// GET /api/photos/:id/full — serve full-size photo
router.get('/:id/full', (req, res) => {
  const { id } = req.params;
  const photo = db.prepare('SELECT filename FROM photos WHERE id = ?').get(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  res.sendFile(resolve(PHOTOS_DIR, photo.filename));
});

export default router;
