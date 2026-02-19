import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET / — all tagged photos ordered by rank, available before taken
router.get('/', (req, res) => {
  const photos = db.prepare(`
    SELECT *,
      (SELECT COUNT(*) FROM photos p2
       WHERE p2.tag != 'unrated'
         AND p2.group_position IS NOT NULL
         AND (
           CASE p2.tag WHEN 'love' THEN 1 WHEN 'like' THEN 2 WHEN 'meh' THEN 3 WHEN 'tax_deduction' THEN 4 END
           < CASE photos.tag WHEN 'love' THEN 1 WHEN 'like' THEN 2 WHEN 'meh' THEN 3 WHEN 'tax_deduction' THEN 4 END
         )
      ) + group_position as global_rank
    FROM photos
    WHERE tag != 'unrated' AND group_position IS NOT NULL
    ORDER BY
      taken,
      CASE tag WHEN 'love' THEN 1 WHEN 'like' THEN 2 WHEN 'meh' THEN 3 WHEN 'tax_deduction' THEN 4 END,
      group_position
  `).all();

  res.json({ photos });
});

// PATCH /:id/take — mark a photo as taken
router.patch('/:id/take', (req, res) => {
  const { id } = req.params;

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  if (photo.tag === 'unrated') return res.status(400).json({ error: 'Photo is not tagged' });
  if (photo.taken) return res.status(400).json({ error: 'Photo is already taken' });

  db.prepare('UPDATE photos SET taken = 1 WHERE id = ?').run(id);

  const updated = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  res.json(updated);
});

// PATCH /:id/restore — restore a taken photo
router.patch('/:id/restore', (req, res) => {
  const { id } = req.params;

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  if (!photo.taken) return res.status(400).json({ error: 'Photo is not taken' });

  db.prepare('UPDATE photos SET taken = 0 WHERE id = ?').run(id);

  const updated = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  res.json(updated);
});

export default router;
