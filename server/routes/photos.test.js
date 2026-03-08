import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import db from '../db.js';
import photosRouter from './photos.js';

const app = express();
app.use(express.json());
// Mock session middleware — inject userId
app.use((req, res, next) => {
  req.session = { userId: 1, isAdmin: true };
  next();
});
app.use('/api/photos', photosRouter);

function insertUser() {
  db.prepare(
    'INSERT OR IGNORE INTO users (id, username, password_hash, is_admin) VALUES (1, \'testuser\', \'hash\', 1)',
  ).run();
  return 1;
}

function insertPhoto(overrides = {}) {
  const defaults = {
    filename: 'photo.jpg',
    tag: 'unrated',
    group_position: null,
    taken: 0,
    show_id: null,
    artist: null,
    title: null,
    medium: null,
    dimensions: null,
    flickr_id: null,
  };
  const data = { ...defaults, ...overrides };
  const result = db
    .prepare(
      `INSERT INTO photos (filename, taken, show_id, artist, title, medium, dimensions, flickr_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.filename,
      data.taken,
      data.show_id,
      data.artist,
      data.title,
      data.medium,
      data.dimensions,
      data.flickr_id,
    );

  const photoId = result.lastInsertRowid;

  if (data.tag !== 'unrated') {
    db.prepare(
      'INSERT INTO user_ratings (user_id, photo_id, tag, group_position) VALUES (?, ?, ?, ?)',
    ).run(1, photoId, data.tag, data.group_position);
  }

  return photoId;
}

function clearData() {
  db.prepare('DELETE FROM user_ratings').run();
  db.prepare('DELETE FROM photos').run();
  db.prepare('DELETE FROM users').run();
}

beforeEach(() => {
  clearData();
  insertUser();
});

afterEach(clearData);

describe('GET /api/photos', () => {
  it('returns all photos with counts', async () => {
    insertPhoto({ filename: 'a.jpg', show_id: '1' });
    insertPhoto({ filename: 'b.jpg', show_id: '2' });

    const res = await request(app).get('/api/photos').expect(200);

    assert.equal(res.body.photos.length, 2);
    assert.equal(res.body.counts.total, 2);
    assert.equal(res.body.counts.unrated, 2);
  });

  it('filters by tag', async () => {
    insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1 });
    insertPhoto({ filename: 'b.jpg', tag: 'meh', group_position: 1 });
    insertPhoto({ filename: 'c.jpg' });

    const res = await request(app).get('/api/photos?tag=love').expect(200);

    assert.equal(res.body.photos.length, 1);
    assert.equal(res.body.photos[0].tag, 'love');
  });

  it('search matches across metadata columns', async () => {
    insertPhoto({ filename: 'a.jpg', artist: 'Picasso', show_id: '10' });
    insertPhoto({ filename: 'b.jpg', title: 'Sunset', show_id: '20' });
    insertPhoto({ filename: 'c.jpg', medium: 'Oil', show_id: '30' });
    insertPhoto({ filename: 'd.jpg', show_id: '42' });

    const res = await request(app)
      .get('/api/photos?search=Picasso')
      .expect(200);
    assert.equal(res.body.photos.length, 1);
    assert.equal(res.body.photos[0].artist, 'Picasso');

    const res2 = await request(app).get('/api/photos?search=42').expect(200);
    assert.equal(res2.body.photos.length, 1);
    assert.equal(res2.body.photos[0].show_id, '42');

    const res3 = await request(app)
      .get('/api/photos?search=Sunset')
      .expect(200);
    assert.equal(res3.body.photos.length, 1);
    assert.equal(res3.body.photos[0].title, 'Sunset');

    const res4 = await request(app).get('/api/photos?search=Oil').expect(200);
    assert.equal(res4.body.photos.length, 1);
    assert.equal(res4.body.photos[0].medium, 'Oil');
  });

  it('hideClaimed=1 excludes taken photos', async () => {
    insertPhoto({ filename: 'a.jpg', taken: 0 });
    insertPhoto({ filename: 'b.jpg', taken: 1 });

    const res = await request(app).get('/api/photos?hideClaimed=1').expect(200);

    assert.equal(res.body.photos.length, 1);
    assert.equal(res.body.counts.total, 1);
  });

  it('tagged photos sorted by priority then group_position', async () => {
    insertPhoto({
      filename: 'a.jpg',
      tag: 'meh',
      group_position: 2,
      show_id: '1',
    });
    insertPhoto({
      filename: 'b.jpg',
      tag: 'love',
      group_position: 1,
      show_id: '2',
    });
    insertPhoto({
      filename: 'c.jpg',
      tag: 'meh',
      group_position: 1,
      show_id: '3',
    });
    insertPhoto({
      filename: 'd.jpg',
      tag: 'love',
      group_position: 2,
      show_id: '4',
    });

    const res = await request(app).get('/api/photos').expect(200);
    const tags = res.body.photos.map((p) => `${p.tag}:${p.group_position}`);

    assert.deepEqual(tags, ['love:1', 'love:2', 'meh:1', 'meh:2']);
  });

  it('unrated photos sorted by show_id', async () => {
    insertPhoto({ filename: 'a.jpg', show_id: '30' });
    insertPhoto({ filename: 'b.jpg', show_id: '5' });
    insertPhoto({ filename: 'c.jpg', show_id: '12' });

    const res = await request(app).get('/api/photos?tag=unrated').expect(200);
    const showIds = res.body.photos.map((p) => p.show_id);

    assert.deepEqual(showIds, ['5', '12', '30']);
  });

  it('sort=show_id returns all photos ordered by show_id numerically', async () => {
    insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1, show_id: '30' });
    insertPhoto({ filename: 'b.jpg', show_id: '5' });
    insertPhoto({ filename: 'c.jpg', tag: 'meh', group_position: 1, show_id: '12' });

    const res = await request(app).get('/api/photos?sort=show_id').expect(200);
    const showIds = res.body.photos.map((p) => p.show_id);

    assert.deepEqual(showIds, ['5', '12', '30']);
    assert.equal(res.body.photos.length, 3);
  });

  it('sort=show_id ignores tag filter param', async () => {
    insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1, show_id: '1' });
    insertPhoto({ filename: 'b.jpg', show_id: '2' });

    const res = await request(app).get('/api/photos?sort=show_id&tag=love').expect(200);

    // Should return all photos regardless of tag filter
    assert.equal(res.body.photos.length, 2);
  });

  it('sort=show_id returns empty counts', async () => {
    insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1, show_id: '1' });

    const res = await request(app).get('/api/photos?sort=show_id').expect(200);

    assert.equal(res.body.counts.total, 0);
    assert.equal(res.body.counts.love, 0);
  });

  it('sort=show_id supports search param', async () => {
    insertPhoto({ filename: 'a.jpg', artist: 'Picasso', show_id: '1' });
    insertPhoto({ filename: 'b.jpg', artist: 'Monet', show_id: '2' });

    const res = await request(app).get('/api/photos?sort=show_id&search=Picasso').expect(200);

    assert.equal(res.body.photos.length, 1);
    assert.equal(res.body.photos[0].artist, 'Picasso');
  });

  it('sort=show_id supports hideClaimed param', async () => {
    insertPhoto({ filename: 'a.jpg', show_id: '1', taken: 0 });
    insertPhoto({ filename: 'b.jpg', show_id: '2', taken: 1 });

    const res = await request(app).get('/api/photos?sort=show_id&hideClaimed=1').expect(200);

    assert.equal(res.body.photos.length, 1);
  });

  it('sort=show_id includes tag info from user_ratings', async () => {
    insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1, show_id: '1' });

    const res = await request(app).get('/api/photos?sort=show_id').expect(200);

    assert.equal(res.body.photos[0].tag, 'love');
  });

  it('global rank computed correctly', async () => {
    insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 1,
    });
    insertPhoto({
      filename: 'b.jpg',
      tag: 'love',
      group_position: 2,
    });
    insertPhoto({
      filename: 'c.jpg',
      tag: 'like',
      group_position: 1,
    });
    insertPhoto({ filename: 'd.jpg' }); // unrated — no global rank

    const res = await request(app).get('/api/photos').expect(200);
    const ranks = res.body.photos.map((p) => p.global_rank);

    assert.deepEqual(ranks, [1, 2, 3, null]);
  });
});

describe('PATCH /api/photos/:id/tag', () => {
  it('set tag on unrated photo assigns group_position at end', async () => {
    insertPhoto({
      filename: 'existing.jpg',
      tag: 'love',
      group_position: 1,
    });
    const id = insertPhoto({ filename: 'new.jpg' });

    const res = await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: 'love' })
      .expect(200);

    assert.equal(res.body.tag, 'love');
    assert.equal(res.body.group_position, 2);
  });

  it('clear tag sets unrated and nulls group_position', async () => {
    const id = insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 1,
    });

    const res = await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: 'unrated' })
      .expect(200);

    assert.equal(res.body.tag, 'unrated');
    assert.equal(res.body.group_position, null);
  });

  it('promote (meh→love) appends to bottom of new group', async () => {
    insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 1,
    });
    const id = insertPhoto({
      filename: 'b.jpg',
      tag: 'meh',
      group_position: 1,
    });

    const res = await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: 'love' })
      .expect(200);

    assert.equal(res.body.tag, 'love');
    assert.equal(res.body.group_position, 2);
  });

  it('demote (love→meh) inserts at top of new group', async () => {
    const id = insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 1,
    });
    insertPhoto({
      filename: 'b.jpg',
      tag: 'meh',
      group_position: 1,
    });

    const res = await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: 'meh' })
      .expect(200);

    assert.equal(res.body.tag, 'meh');
    assert.equal(res.body.group_position, 1);

    // Original meh photo should have been shifted to position 2
    const shifted = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = (SELECT id FROM photos WHERE filename = ?)')
      .get('b.jpg');
    assert.equal(shifted.group_position, 2);
  });

  it('recompacts old group positions when removing', async () => {
    const id1 = insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 1,
    });
    const id2 = insertPhoto({
      filename: 'b.jpg',
      tag: 'love',
      group_position: 2,
    });
    const id3 = insertPhoto({
      filename: 'c.jpg',
      tag: 'love',
      group_position: 3,
    });

    await request(app)
      .patch(`/api/photos/${id1}/tag`)
      .send({ tag: 'unrated' })
      .expect(200);

    const shifted1 = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = ?')
      .get(id2);
    assert.equal(shifted1.group_position, 1);

    const shifted2 = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = ?')
      .get(id3);
    assert.equal(shifted2.group_position, 2);
  });

  it('returns 404 for missing photo', async () => {
    await request(app)
      .patch('/api/photos/99999/tag')
      .send({ tag: 'love' })
      .expect(404);
  });

  it('returns 400 for invalid tag', async () => {
    const id = insertPhoto({ filename: 'a.jpg' });

    await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: 'invalid' })
      .expect(400);
  });
});

describe('PATCH /api/photos/:id/reorder', () => {
  it('move photo down within group', async () => {
    const id1 = insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 1,
    });
    const id2 = insertPhoto({
      filename: 'b.jpg',
      tag: 'love',
      group_position: 2,
    });
    const id3 = insertPhoto({
      filename: 'c.jpg',
      tag: 'love',
      group_position: 3,
    });

    const res = await request(app)
      .patch(`/api/photos/${id1}/reorder`)
      .send({ newPosition: 3 })
      .expect(200);

    assert.equal(res.body.group_position, 3);

    const p2 = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = ?')
      .get(id2);
    const p3 = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = ?')
      .get(id3);
    assert.equal(p2.group_position, 1);
    assert.equal(p3.group_position, 2);
  });

  it('move photo up within group', async () => {
    const id1 = insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 1,
    });
    const id2 = insertPhoto({
      filename: 'b.jpg',
      tag: 'love',
      group_position: 2,
    });
    const id3 = insertPhoto({
      filename: 'c.jpg',
      tag: 'love',
      group_position: 3,
    });

    const res = await request(app)
      .patch(`/api/photos/${id3}/reorder`)
      .send({ newPosition: 1 })
      .expect(200);

    assert.equal(res.body.group_position, 1);

    const p1 = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = ?')
      .get(id1);
    const p2 = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = ?')
      .get(id2);
    assert.equal(p1.group_position, 2);
    assert.equal(p2.group_position, 3);
  });

  it('no-op when position unchanged', async () => {
    const id = insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 2,
    });

    const res = await request(app)
      .patch(`/api/photos/${id}/reorder`)
      .send({ newPosition: 2 })
      .expect(200);

    assert.equal(res.body.group_position, 2);
  });

  it('returns 404 for missing photo', async () => {
    await request(app)
      .patch('/api/photos/99999/reorder')
      .send({ newPosition: 1 })
      .expect(404);
  });

  it('clamps position to max when exceeding group size', async () => {
    const id1 = insertPhoto({
      filename: 'a.jpg',
      tag: 'love',
      group_position: 1,
    });
    const id2 = insertPhoto({
      filename: 'b.jpg',
      tag: 'love',
      group_position: 2,
    });
    const id3 = insertPhoto({
      filename: 'c.jpg',
      tag: 'love',
      group_position: 3,
    });

    const res = await request(app)
      .patch(`/api/photos/${id1}/reorder`)
      .send({ newPosition: 25 })
      .expect(200);

    // Should be clamped to 3 (max position in the group)
    assert.equal(res.body.group_position, 3);

    const p2 = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = ?')
      .get(id2);
    const p3 = db
      .prepare('SELECT group_position FROM user_ratings WHERE user_id = 1 AND photo_id = ?')
      .get(id3);
    assert.equal(p2.group_position, 1);
    assert.equal(p3.group_position, 2);
  });

  it('returns 400 for unrated photo', async () => {
    const id = insertPhoto({ filename: 'a.jpg' });

    await request(app)
      .patch(`/api/photos/${id}/reorder`)
      .send({ newPosition: 1 })
      .expect(400);
  });
});

describe('GET /api/photos/:id/full', () => {
  it('returns 404 for missing photo', async () => {
    await request(app).get('/api/photos/99999/full').expect(404);
  });
});
