import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import db from '../db.js';
import showtimeRouter from './showtime.js';

const app = express();
app.use(express.json());
app.use('/api/showtime/photos', showtimeRouter);

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
      `INSERT INTO photos (filename, tag, group_position, taken, show_id, artist, title, medium, dimensions, flickr_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.filename,
      data.tag,
      data.group_position,
      data.taken,
      data.show_id,
      data.artist,
      data.title,
      data.medium,
      data.dimensions,
      data.flickr_id,
    );
  return result.lastInsertRowid;
}

function clearPhotos() {
  db.prepare('DELETE FROM photos').run();
}

describe('GET /api/showtime/photos', () => {
  beforeEach(clearPhotos);
  afterEach(clearPhotos);

  it('returns only tagged photos with global rank', async () => {
    insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1 });
    insertPhoto({ filename: 'b.jpg' }); // unrated

    const res = await request(app).get('/api/showtime/photos').expect(200);

    assert.equal(res.body.photos.length, 1);
    assert.equal(res.body.photos[0].tag, 'love');
    assert.ok(res.body.photos[0].global_rank != null);
  });

  it('orders by taken then priority then group_position', async () => {
    insertPhoto({ filename: 'a.jpg', tag: 'like', group_position: 1, taken: 0 });
    insertPhoto({ filename: 'b.jpg', tag: 'love', group_position: 1, taken: 1 });
    insertPhoto({ filename: 'c.jpg', tag: 'love', group_position: 1, taken: 0 });

    const res = await request(app).get('/api/showtime/photos').expect(200);

    // Available photos first (taken=0), then taken photos (taken=1)
    assert.equal(res.body.photos[0].filename, 'c.jpg'); // love, available
    assert.equal(res.body.photos[1].filename, 'a.jpg'); // like, available
    assert.equal(res.body.photos[2].filename, 'b.jpg'); // love, taken
  });

  it('returns empty array when no tagged photos', async () => {
    insertPhoto({ filename: 'a.jpg' }); // unrated

    const res = await request(app).get('/api/showtime/photos').expect(200);

    assert.deepEqual(res.body.photos, []);
  });
});

describe('PATCH /api/showtime/photos/:id/take', () => {
  beforeEach(clearPhotos);
  afterEach(clearPhotos);

  it('marks a tagged photo as taken', async () => {
    const id = insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1 });

    const res = await request(app)
      .patch(`/api/showtime/photos/${id}/take`)
      .expect(200);

    assert.equal(res.body.taken, 1);
  });

  it('returns 404 for missing photo', async () => {
    await request(app)
      .patch('/api/showtime/photos/99999/take')
      .expect(404);
  });

  it('returns 400 for unrated photo', async () => {
    const id = insertPhoto({ filename: 'a.jpg' });

    const res = await request(app)
      .patch(`/api/showtime/photos/${id}/take`)
      .expect(400);

    assert.match(res.body.error, /not tagged/);
  });

  it('returns 400 if already taken', async () => {
    const id = insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1, taken: 1 });

    const res = await request(app)
      .patch(`/api/showtime/photos/${id}/take`)
      .expect(400);

    assert.match(res.body.error, /already taken/);
  });
});

describe('PATCH /api/showtime/photos/:id/restore', () => {
  beforeEach(clearPhotos);
  afterEach(clearPhotos);

  it('restores a taken photo', async () => {
    const id = insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1, taken: 1 });

    const res = await request(app)
      .patch(`/api/showtime/photos/${id}/restore`)
      .expect(200);

    assert.equal(res.body.taken, 0);
  });

  it('returns 404 for missing photo', async () => {
    await request(app)
      .patch('/api/showtime/photos/99999/restore')
      .expect(404);
  });

  it('returns 400 if photo is not taken', async () => {
    const id = insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 1 });

    const res = await request(app)
      .patch(`/api/showtime/photos/${id}/restore`)
      .expect(400);

    assert.match(res.body.error, /not taken/);
  });
});
