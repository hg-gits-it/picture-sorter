import { Router } from 'express';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

const router = Router();

// GET /api/photos — list photos with computed global rank
router.get('/', (req, res) => {
  const { tag, search, hideClaimed } = req.query;

  let where = [];
  let params = [];

  if (tag) {
    where.push('tag = ?');
    params.push(tag);
  }

  if (search) {
    where.push(
      '(number LIKE ? OR artist LIKE ? OR title LIKE ? OR medium LIKE ?)',
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (hideClaimed === '1') {
    where.push('taken = 0');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Compute global rank using window functions
  // Priority: love=1, like=2, meh=3, tax_deduction=4, null=5
  const sql = `
    SELECT *,
      CASE
        WHEN tag != 'unrated' AND group_position IS NOT NULL THEN
          (SELECT COUNT(*) FROM photos p2
           WHERE p2.tag != 'unrated'
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
    ORDER BY
      CASE WHEN tag = 'unrated' THEN 1 ELSE 0 END,
      CASE tag WHEN 'love' THEN 1 WHEN 'like' THEN 2 WHEN 'meh' THEN 3 WHEN 'tax_deduction' THEN 4 ELSE 5 END,
      group_position,
      CAST(number AS INTEGER)
  `;

  const photos = db.prepare(sql).all(...params);

  // Also return counts for filter badges
  const countsWhere = hideClaimed === '1' ? 'WHERE taken = 0' : '';
  const counts = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN tag = 'love' THEN 1 ELSE 0 END), 0) as love,
      COALESCE(SUM(CASE WHEN tag = 'like' THEN 1 ELSE 0 END), 0) as 'like',
      COALESCE(SUM(CASE WHEN tag = 'meh' THEN 1 ELSE 0 END), 0) as meh,
      COALESCE(SUM(CASE WHEN tag = 'tax_deduction' THEN 1 ELSE 0 END), 0) as tax_deduction,
      COALESCE(SUM(CASE WHEN tag = 'unrated' THEN 1 ELSE 0 END), 0) as unrated
    FROM photos ${countsWhere}
  `,
    )
    .get();

  res.json({ photos, counts });
});

// PATCH /api/photos/:id/tag — set or clear tag
router.patch('/:id/tag', (req, res) => {
  const { id } = req.params;
  const tag = req.body.tag ?? 'unrated'; // normalize null to 'unrated'

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const validTags = ['love', 'like', 'meh', 'tax_deduction', 'unrated'];
  if (!validTags.includes(tag)) {
    return res.status(400).json({ error: 'Invalid tag' });
  }

  const updateTag = db.transaction(() => {
    const oldTag = photo.tag;
    const oldPosition = photo.group_position;

    // Remove from old group and recompact
    if (oldTag !== 'unrated' && oldPosition != null) {
      db.prepare(
        `
        UPDATE photos SET group_position = group_position - 1
        WHERE tag = ? AND group_position > ?
      `,
      ).run(oldTag, oldPosition);
    }

    if (tag !== 'unrated') {
      const priority = { love: 1, like: 2, meh: 3, tax_deduction: 4 };
      const demoting = oldTag !== 'unrated' && priority[oldTag] < priority[tag];

      let newPosition;
      if (demoting) {
        // Demoting (higher → lower priority): insert at top
        db.prepare(
          `
          UPDATE photos SET group_position = group_position + 1
          WHERE tag = ?
        `,
        ).run(tag);
        newPosition = 1;
      } else {
        // Promoting or newly rated: append to bottom
        const maxPos = db
          .prepare(
            'SELECT COALESCE(MAX(group_position), 0) as max_pos FROM photos WHERE tag = ?',
          )
          .get(tag);
        newPosition = maxPos.max_pos + 1;
      }

      db.prepare(
        'UPDATE photos SET tag = ?, group_position = ? WHERE id = ?',
      ).run(tag, newPosition, id);
    } else {
      // Clear tag — set to unrated
      db.prepare(
        'UPDATE photos SET tag = \'unrated\', group_position = NULL WHERE id = ?',
      ).run(id);
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
  if (photo.tag === 'unrated')
    return res.status(400).json({ error: 'Cannot reorder unrated photo' });

  const oldPosition = photo.group_position;
  if (oldPosition === newPosition) return res.json(photo);

  const reorder = db.transaction(() => {
    if (newPosition > oldPosition) {
      // Moving down: shift items between old+1..new up by 1
      db.prepare(
        `
        UPDATE photos SET group_position = group_position - 1
        WHERE tag = ? AND group_position > ? AND group_position <= ?
      `,
      ).run(photo.tag, oldPosition, newPosition);
    } else {
      // Moving up: shift items between new..old-1 down by 1
      db.prepare(
        `
        UPDATE photos SET group_position = group_position + 1
        WHERE tag = ? AND group_position >= ? AND group_position < ?
      `,
      ).run(photo.tag, newPosition, oldPosition);
    }

    db.prepare('UPDATE photos SET group_position = ? WHERE id = ?').run(
      newPosition,
      id,
    );
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

  res.sendFile(resolve(PROJECT_ROOT, photo.filename));
});

export default router;
