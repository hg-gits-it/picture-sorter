import { Router } from 'express';
import db, { getPhotoById } from '../db.js';
import { tagPrioritySQL } from '../utils/tagPriority.js';

const router = Router();

// GET / — all tagged photos ordered by rank (using admin's ratings)
router.get('/', (req, res) => {
  const userId = req.session.userId;

  const photos = db.prepare(`
    SELECT p.id, p.filename, p.taken, p.show_id, p.artist, p.title,
           p.medium, p.dimensions, p.flickr_id, p.created_at,
           COALESCE(ur.tag, 'unrated') as tag, ur.group_position,
      (SELECT COUNT(*) FROM user_ratings ur2
       WHERE ur2.user_id = ?
         AND ur2.tag != 'unrated'
         AND ur2.group_position IS NOT NULL
         AND (
           ${tagPrioritySQL('ur2.tag')}
           < ${tagPrioritySQL('ur.tag')}
         )
      ) + ur.group_position as global_rank
    FROM photos p
    INNER JOIN user_ratings ur ON ur.photo_id = p.id AND ur.user_id = ?
    WHERE ur.tag != 'unrated' AND ur.group_position IS NOT NULL
    ORDER BY
      p.taken,
      ${tagPrioritySQL('ur.tag')},
      ur.group_position
  `).all(userId, userId);

  res.json({ photos });
});

// PATCH /:id/take — mark a photo as taken (global)
router.patch('/:id/take', (req, res) => {
  const { id } = req.params;

  const photo = getPhotoById(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  // Check if this photo is tagged by the admin user
  const userId = req.session.userId;
  const rating = db.prepare(
    'SELECT tag FROM user_ratings WHERE user_id = ? AND photo_id = ? AND tag != \'unrated\'',
  ).get(userId, id);
  if (!rating) return res.status(400).json({ error: 'Photo is not tagged' });
  if (photo.taken) return res.status(400).json({ error: 'Photo is already taken' });

  db.prepare('UPDATE photos SET taken = 1 WHERE id = ?').run(id);

  const updated = getPhotoById(id);
  // Return with tag info from user_ratings
  updated.tag = rating.tag;
  res.json(updated);
});

// PATCH /:id/restore — restore a taken photo (global)
router.patch('/:id/restore', (req, res) => {
  const { id } = req.params;

  const photo = getPhotoById(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  if (!photo.taken) return res.status(400).json({ error: 'Photo is not taken' });

  db.prepare('UPDATE photos SET taken = 0 WHERE id = ?').run(id);

  const updated = getPhotoById(id);
  res.json(updated);
});

export default router;
