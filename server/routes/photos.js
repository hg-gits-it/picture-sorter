import { Router } from 'express';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import db, { getPhotoById, getPhotoFilenameById, getUserPhoto } from '../db.js';
import { TAG_PRIORITY, tagPrioritySQL } from '../utils/tagPriority.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

const router = Router();

// GET /api/photos — list photos with computed global rank (per-user ratings)
router.get('/', (req, res) => {
  const userId = req.session.userId;
  const { tag, search, hideClaimed, sort } = req.query;

  // Show ID sort mode: flat list ordered by show_id, ignore tag filter
  if (sort === 'show_id') {
    let where = [];
    let whereParams = [];

    if (search) {
      where.push(
        '(p.show_id LIKE ? OR p.artist LIKE ? OR p.title LIKE ? OR p.medium LIKE ?)',
      );
      whereParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (hideClaimed === '1') {
      where.push('p.taken = 0');
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT p.id, p.filename, p.taken, p.show_id, p.artist, p.title,
             p.medium, p.dimensions, p.flickr_id, p.created_at,
             COALESCE(ur.tag, 'unrated') as tag, ur.group_position,
             NULL as global_rank
      FROM photos p
      LEFT JOIN user_ratings ur ON ur.photo_id = p.id AND ur.user_id = ?
      ${whereClause}
      ORDER BY CAST(p.show_id AS INTEGER)
    `;

    const photos = db.prepare(sql).all(userId, ...whereParams);
    const counts = { total: 0, love: 0, like: 0, meh: 0, pass: 0, unrated: 0 };
    return res.json({ photos, counts });
  }

  let where = [];
  let whereParams = [];

  if (tag) {
    where.push('COALESCE(ur.tag, \'unrated\') = ?');
    whereParams.push(tag);
  }

  if (search) {
    where.push(
      '(p.show_id LIKE ? OR p.artist LIKE ? OR p.title LIKE ? OR p.medium LIKE ?)',
    );
    whereParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (hideClaimed === '1') {
    where.push('p.taken = 0');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT p.id, p.filename, p.taken, p.show_id, p.artist, p.title,
           p.medium, p.dimensions, p.flickr_id, p.created_at,
           COALESCE(ur.tag, 'unrated') as tag, ur.group_position,
      CASE
        WHEN COALESCE(ur.tag, 'unrated') != 'unrated' AND ur.group_position IS NOT NULL THEN
          (SELECT COUNT(*) FROM user_ratings ur2
           WHERE ur2.user_id = ?
             AND ur2.tag != 'unrated'
             AND ur2.group_position IS NOT NULL
             AND (
               ${tagPrioritySQL('ur2.tag')}
               < ${tagPrioritySQL('ur.tag')}
             )
          ) + ur.group_position
        ELSE NULL
      END as global_rank
    FROM photos p
    LEFT JOIN user_ratings ur ON ur.photo_id = p.id AND ur.user_id = ?
    ${whereClause}
    ORDER BY
      CASE WHEN COALESCE(ur.tag, 'unrated') = 'unrated' THEN 1 ELSE 0 END,
      ${tagPrioritySQL('COALESCE(ur.tag, \'unrated\')')},
      ur.group_position,
      CAST(p.show_id AS INTEGER)
  `;

  // userId appears twice: once for subquery user_id, once for LEFT JOIN
  const photos = db.prepare(sql).all(userId, userId, ...whereParams);

  // Counts query (per-user)
  const countsWhere = hideClaimed === '1' ? 'AND p.taken = 0' : '';
  const counts = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN COALESCE(ur.tag, 'unrated') = 'love' THEN 1 ELSE 0 END), 0) as love,
      COALESCE(SUM(CASE WHEN COALESCE(ur.tag, 'unrated') = 'like' THEN 1 ELSE 0 END), 0) as 'like',
      COALESCE(SUM(CASE WHEN COALESCE(ur.tag, 'unrated') = 'meh' THEN 1 ELSE 0 END), 0) as meh,
      COALESCE(SUM(CASE WHEN COALESCE(ur.tag, 'unrated') = 'pass' THEN 1 ELSE 0 END), 0) as pass,
      COALESCE(SUM(CASE WHEN COALESCE(ur.tag, 'unrated') = 'unrated' THEN 1 ELSE 0 END), 0) as unrated
    FROM photos p
    LEFT JOIN user_ratings ur ON ur.photo_id = p.id AND ur.user_id = ?
    WHERE 1=1 ${countsWhere}
  `,
    )
    .get(userId);

  res.json({ photos, counts });
});

// PATCH /api/photos/:id/tag — set or clear tag (per-user)
router.patch('/:id/tag', (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  const tag = req.body.tag ?? 'unrated';

  const basePhoto = getPhotoById(id);
  if (!basePhoto) return res.status(404).json({ error: 'Photo not found' });

  const validTags = ['love', 'like', 'meh', 'pass', 'unrated'];
  if (!validTags.includes(tag)) {
    return res.status(400).json({ error: 'Invalid tag' });
  }

  const updateTag = db.transaction(() => {
    // Get current user rating
    const currentRating = db.prepare(
      'SELECT tag, group_position FROM user_ratings WHERE user_id = ? AND photo_id = ?',
    ).get(userId, id);

    const oldTag = currentRating?.tag || 'unrated';
    const oldPosition = currentRating?.group_position ?? null;

    // Remove from old group and recompact
    if (oldTag !== 'unrated' && oldPosition != null) {
      db.prepare(
        `UPDATE user_ratings SET group_position = group_position - 1
         WHERE user_id = ? AND tag = ? AND group_position > ?`,
      ).run(userId, oldTag, oldPosition);
    }

    if (tag !== 'unrated') {
      const demoting = oldTag !== 'unrated' && TAG_PRIORITY[oldTag] < TAG_PRIORITY[tag];

      let newPosition;
      if (demoting) {
        // Demoting (higher → lower priority): insert at top
        db.prepare(
          `UPDATE user_ratings SET group_position = group_position + 1
           WHERE user_id = ? AND tag = ?`,
        ).run(userId, tag);
        newPosition = 1;
      } else {
        // Promoting or newly rated: append to bottom
        const maxPos = db
          .prepare(
            'SELECT COALESCE(MAX(group_position), 0) as max_pos FROM user_ratings WHERE user_id = ? AND tag = ?',
          )
          .get(userId, tag);
        newPosition = maxPos.max_pos + 1;
      }

      // Upsert into user_ratings
      db.prepare(
        `INSERT INTO user_ratings (user_id, photo_id, tag, group_position)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, photo_id) DO UPDATE SET tag = excluded.tag, group_position = excluded.group_position`,
      ).run(userId, id, tag, newPosition);
    } else {
      // Clear tag — remove the user_rating row (or set to unrated with no position)
      db.prepare(
        'DELETE FROM user_ratings WHERE user_id = ? AND photo_id = ?',
      ).run(userId, id);
    }
  });

  updateTag();

  const updated = getUserPhoto(userId, id);
  res.json(updated);
});

// PATCH /api/photos/:id/reorder — move photo within its tag group (per-user)
router.patch('/:id/reorder', (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  const { newPosition } = req.body;

  const basePhoto = getPhotoById(id);
  if (!basePhoto) return res.status(404).json({ error: 'Photo not found' });

  const rating = db.prepare(
    'SELECT tag, group_position FROM user_ratings WHERE user_id = ? AND photo_id = ?',
  ).get(userId, id);

  if (!rating || rating.tag === 'unrated') {
    return res.status(400).json({ error: 'Cannot reorder unrated photo' });
  }

  const oldPosition = rating.group_position;
  if (oldPosition === newPosition) {
    return res.json(getUserPhoto(userId, id));
  }

  const reorder = db.transaction(() => {
    if (newPosition > oldPosition) {
      db.prepare(
        `UPDATE user_ratings SET group_position = group_position - 1
         WHERE user_id = ? AND tag = ? AND group_position > ? AND group_position <= ?`,
      ).run(userId, rating.tag, oldPosition, newPosition);
    } else {
      db.prepare(
        `UPDATE user_ratings SET group_position = group_position + 1
         WHERE user_id = ? AND tag = ? AND group_position >= ? AND group_position < ?`,
      ).run(userId, rating.tag, newPosition, oldPosition);
    }

    db.prepare(
      'UPDATE user_ratings SET group_position = ? WHERE user_id = ? AND photo_id = ?',
    ).run(newPosition, userId, id);
  });

  reorder();

  const updated = getUserPhoto(userId, id);
  res.json(updated);
});

// GET /api/photos/:id/full — serve full-size photo
router.get('/:id/full', (req, res) => {
  const { id } = req.params;
  const photo = getPhotoFilenameById(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  res.sendFile(resolve(PROJECT_ROOT, photo.filename));
});

export default router;
