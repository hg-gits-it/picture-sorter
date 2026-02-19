import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import db from '../db.js';
import scanRouter from './scan.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const TEST_PHOTOS_DIR = resolve(PROJECT_ROOT, 'photos', 'test-photos');
const TEST_THUMBNAILS_DIR = resolve(PROJECT_ROOT, 'data', 'test-thumbnails');

// Point scan route at test directories
process.env.PHOTOS_DIR = TEST_PHOTOS_DIR;
process.env.THUMBNAILS_DIR = TEST_THUMBNAILS_DIR;

const app = express();
app.use(express.json());
app.use('/api/scan', scanRouter);

// Create a minimal 1x1 red JPEG buffer for test images
let testImageBuffer;
before(async () => {
  testImageBuffer = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
});

function clearPhotos() {
  db.prepare('DELETE FROM photos').run();
}

function cleanTestDir() {
  if (existsSync(TEST_PHOTOS_DIR)) {
    rmSync(TEST_PHOTOS_DIR, { recursive: true });
  }
  if (existsSync(TEST_THUMBNAILS_DIR)) {
    rmSync(TEST_THUMBNAILS_DIR, { recursive: true });
  }
}

function createImage(name, sidecar) {
  mkdirSync(TEST_PHOTOS_DIR, { recursive: true });
  const absPath = resolve(TEST_PHOTOS_DIR, name);
  writeFileSync(absPath, testImageBuffer);
  if (sidecar) {
    writeFileSync(absPath + '.json', JSON.stringify(sidecar));
  }
}

function cleanThumbnail(name) {
  const thumbPath = resolve(TEST_THUMBNAILS_DIR, name);
  if (existsSync(thumbPath)) rmSync(thumbPath);
}

describe('POST /api/scan', () => {
  beforeEach(() => {
    cleanTestDir();
    clearPhotos();
  });
  after(() => {
    cleanTestDir();
    clearPhotos();
    delete process.env.PHOTOS_DIR;
    delete process.env.THUMBNAILS_DIR;
  });

  it('returns scanned count of 0 when photos dir does not exist', async () => {
    const res = await request(app).post('/api/scan').expect(200);
    assert.equal(res.body.scanned, 0);
  });

  it('inserts photos into DB from photos directory', async () => {
    createImage('test1.jpg');
    createImage('test2.png');

    const res = await request(app).post('/api/scan').expect(200);
    assert.equal(res.body.scanned, 2);

    const photos = db.prepare('SELECT filename FROM photos ORDER BY filename').all();
    assert.equal(photos.length, 2);
    assert.equal(photos[0].filename, 'photos/test-photos/test1.jpg');
    assert.equal(photos[1].filename, 'photos/test-photos/test2.png');
  });

  it('ignores non-image files', async () => {
    createImage('photo.jpg');
    writeFileSync(resolve(TEST_PHOTOS_DIR, 'readme.txt'), 'not an image');

    const res = await request(app).post('/api/scan').expect(200);
    assert.equal(res.body.scanned, 1);

    const photos = db.prepare('SELECT * FROM photos').all();
    assert.equal(photos.length, 1);
  });

  it('parses metadata from Flickr JSON sidecar', async () => {
    createImage('photo.jpg', {
      title: '042 | Jane Doe | Sunset | Oil | 10x12',
      id: 12345,
    });

    await request(app).post('/api/scan').expect(200);

    const photo = db.prepare('SELECT * FROM photos').get();
    assert.equal(photo.show_id, '042');
    assert.equal(photo.artist, 'Jane Doe');
    assert.equal(photo.title, 'Sunset');
    assert.equal(photo.medium, 'Oil');
    assert.equal(photo.dimensions, '10x12');
    assert.equal(photo.flickr_id, '12345');
  });

  it('does not overwrite metadata on rescan', async () => {
    createImage('photo.jpg', {
      title: '042 | Jane Doe | Sunset | Oil | 10x12',
      id: 12345,
    });

    await request(app).post('/api/scan').expect(200);

    // Manually update artist to simulate user edit, then rescan
    db.prepare('UPDATE photos SET artist = \'Updated\' WHERE filename = \'photos/test-photos/photo.jpg\'').run();

    await request(app).post('/api/scan').expect(200);

    const photo = db.prepare('SELECT artist FROM photos').get();
    assert.equal(photo.artist, 'Updated');
  });

  it('generates thumbnails for photos with flickr_id', async () => {
    cleanThumbnail('99999.jpg');
    createImage('photo.jpg', { title: '001 | A | B | C | D', id: 99999 });

    await request(app).post('/api/scan').expect(200);

    assert.ok(existsSync(resolve(TEST_THUMBNAILS_DIR, '99999.jpg')));
    cleanThumbnail('99999.jpg');
  });

  it('removes orphaned DB entries when files are deleted', async () => {
    createImage('keep.jpg');
    createImage('remove.jpg');

    await request(app).post('/api/scan').expect(200);
    assert.equal(db.prepare('SELECT COUNT(*) as c FROM photos').get().c, 2);

    // Delete one file from disk
    rmSync(resolve(TEST_PHOTOS_DIR, 'remove.jpg'));

    await request(app).post('/api/scan').expect(200);

    const photos = db.prepare('SELECT filename FROM photos').all();
    assert.equal(photos.length, 1);
    assert.equal(photos[0].filename, 'photos/test-photos/keep.jpg');
  });

  it('does not duplicate rows on rescan', async () => {
    createImage('photo.jpg');

    await request(app).post('/api/scan').expect(200);
    await request(app).post('/api/scan').expect(200);

    const count = db.prepare('SELECT COUNT(*) as c FROM photos').get().c;
    assert.equal(count, 1);
  });
});
