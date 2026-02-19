import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import db from "../db.js";
import photosRouter from "./photos.js";

const app = express();
app.use(express.json());
app.use("/api/photos", photosRouter);

// Helper to insert a photo row
function insertPhoto(overrides = {}) {
  const defaults = {
    filename: `photo.jpg`,
    tag: "unrated",
    group_position: null,
    taken: 0,
    number: null,
    artist: null,
    title: null,
    medium: null,
    dimensions: null,
    flickr_id: null,
  };
  const data = { ...defaults, ...overrides };
  const result = db
    .prepare(
      `INSERT INTO photos (filename, tag, group_position, taken, number, artist, title, medium, dimensions, flickr_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.filename,
      data.tag,
      data.group_position,
      data.taken,
      data.number,
      data.artist,
      data.title,
      data.medium,
      data.dimensions,
      data.flickr_id,
    );
  return result.lastInsertRowid;
}

function clearPhotos() {
  db.prepare("DELETE FROM photos").run();
}

describe("GET /api/photos", () => {
  beforeEach(clearPhotos);
  afterEach(clearPhotos);

  it("returns all photos with counts", async () => {
    insertPhoto({ filename: "a.jpg", number: "1" });
    insertPhoto({ filename: "b.jpg", number: "2" });

    const res = await request(app).get("/api/photos").expect(200);

    assert.equal(res.body.photos.length, 2);
    assert.equal(res.body.counts.total, 2);
    assert.equal(res.body.counts.unrated, 2);
  });

  it("filters by tag", async () => {
    insertPhoto({ filename: "a.jpg", tag: "love", group_position: 1 });
    insertPhoto({ filename: "b.jpg", tag: "meh", group_position: 1 });
    insertPhoto({ filename: "c.jpg" });

    const res = await request(app).get("/api/photos?tag=love").expect(200);

    assert.equal(res.body.photos.length, 1);
    assert.equal(res.body.photos[0].tag, "love");
  });

  it("search matches across metadata columns", async () => {
    insertPhoto({ filename: "a.jpg", artist: "Picasso", number: "10" });
    insertPhoto({ filename: "b.jpg", title: "Sunset", number: "20" });
    insertPhoto({ filename: "c.jpg", medium: "Oil", number: "30" });
    insertPhoto({ filename: "d.jpg", number: "42" });

    // search artist
    const res = await request(app)
      .get("/api/photos?search=Picasso")
      .expect(200);
    assert.equal(res.body.photos.length, 1);
    assert.equal(res.body.photos[0].artist, "Picasso");

    // search number
    const res2 = await request(app).get("/api/photos?search=42").expect(200);
    assert.equal(res2.body.photos.length, 1);
    assert.equal(res2.body.photos[0].number, "42");

    // search title
    const res3 = await request(app)
      .get("/api/photos?search=Sunset")
      .expect(200);
    assert.equal(res3.body.photos.length, 1);
    assert.equal(res3.body.photos[0].title, "Sunset");

    // search medium
    const res4 = await request(app).get("/api/photos?search=Oil").expect(200);
    assert.equal(res4.body.photos.length, 1);
    assert.equal(res4.body.photos[0].medium, "Oil");
  });

  it("hideClaimed=1 excludes taken photos", async () => {
    insertPhoto({ filename: "a.jpg", taken: 0 });
    insertPhoto({ filename: "b.jpg", taken: 1 });

    const res = await request(app).get("/api/photos?hideClaimed=1").expect(200);

    assert.equal(res.body.photos.length, 1);
    assert.equal(res.body.counts.total, 1);
  });

  it("tagged photos sorted by priority then group_position", async () => {
    insertPhoto({
      filename: "a.jpg",
      tag: "meh",
      group_position: 2,
      number: "1",
    });
    insertPhoto({
      filename: "b.jpg",
      tag: "love",
      group_position: 1,
      number: "2",
    });
    insertPhoto({
      filename: "c.jpg",
      tag: "meh",
      group_position: 1,
      number: "3",
    });
    insertPhoto({
      filename: "d.jpg",
      tag: "love",
      group_position: 2,
      number: "4",
    });

    const res = await request(app).get("/api/photos").expect(200);
    const tags = res.body.photos.map((p) => `${p.tag}:${p.group_position}`);

    assert.deepEqual(tags, ["love:1", "love:2", "meh:1", "meh:2"]);
  });

  it("unrated photos sorted by number", async () => {
    insertPhoto({ filename: "a.jpg", number: "30" });
    insertPhoto({ filename: "b.jpg", number: "5" });
    insertPhoto({ filename: "c.jpg", number: "12" });

    const res = await request(app).get("/api/photos?tag=unrated").expect(200);
    const numbers = res.body.photos.map((p) => p.number);

    assert.deepEqual(numbers, ["5", "12", "30"]);
  });

  it("global rank computed correctly", async () => {
    // 2 love photos, then 1 like photo
    insertPhoto({
      filename: "a.jpg",
      tag: "love",
      group_position: 1,
    });
    insertPhoto({
      filename: "b.jpg",
      tag: "love",
      group_position: 2,
    });
    insertPhoto({
      filename: "c.jpg",
      tag: "like",
      group_position: 1,
    });
    insertPhoto({ filename: "d.jpg" }); // unrated — no global rank

    const res = await request(app).get("/api/photos").expect(200);
    const ranks = res.body.photos.map((p) => p.global_rank);

    // love has 0 photos before it (priority < love = none), so love ranks = 0 + group_pos
    // like has 2 love photos before it, so like ranks = 2 + group_pos
    assert.deepEqual(ranks, [1, 2, 3, null]);
  });
});

describe("PATCH /api/photos/:id/tag", () => {
  beforeEach(clearPhotos);
  afterEach(clearPhotos);

  it("set tag on unrated photo assigns group_position at end", async () => {
    insertPhoto({
      filename: "existing.jpg",
      tag: "love",
      group_position: 1,
    });
    const id = insertPhoto({ filename: "new.jpg" });

    const res = await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: "love" })
      .expect(200);

    assert.equal(res.body.tag, "love");
    assert.equal(res.body.group_position, 2);
  });

  it("clear tag sets unrated and nulls group_position", async () => {
    const id = insertPhoto({
      filename: "a.jpg",
      tag: "love",
      group_position: 1,
    });

    const res = await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: "unrated" })
      .expect(200);

    assert.equal(res.body.tag, "unrated");
    assert.equal(res.body.group_position, null);
  });

  it("promote (meh→love) appends to bottom of new group", async () => {
    insertPhoto({
      filename: "a.jpg",
      tag: "love",
      group_position: 1,
    });
    const id = insertPhoto({
      filename: "b.jpg",
      tag: "meh",
      group_position: 1,
    });

    const res = await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: "love" })
      .expect(200);

    assert.equal(res.body.tag, "love");
    assert.equal(res.body.group_position, 2); // appended after existing love
  });

  it("demote (love→meh) inserts at top of new group", async () => {
    const id = insertPhoto({
      filename: "a.jpg",
      tag: "love",
      group_position: 1,
    });
    insertPhoto({
      filename: "b.jpg",
      tag: "meh",
      group_position: 1,
    });

    const res = await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: "meh" })
      .expect(200);

    assert.equal(res.body.tag, "meh");
    assert.equal(res.body.group_position, 1); // inserted at top

    // Original meh photo should have been shifted to position 2
    const shifted = db
      .prepare("SELECT group_position FROM photos WHERE filename = ?")
      .get("b.jpg");
    assert.equal(shifted.group_position, 2);
  });

  it("recompacts old group positions when removing", async () => {
    const id1 = insertPhoto({
      filename: "a.jpg",
      tag: "love",
      group_position: 1,
    });
    insertPhoto({
      filename: "b.jpg",
      tag: "love",
      group_position: 2,
    });
    insertPhoto({
      filename: "c.jpg",
      tag: "love",
      group_position: 3,
    });

    // Remove the first one from love
    await request(app)
      .patch(`/api/photos/${id1}/tag`)
      .send({ tag: "unrated" })
      .expect(200);

    // Remaining love photos should have positions 1 and 2
    const shifted1 = db
      .prepare("SELECT group_position FROM photos WHERE filename = ?")
      .get("b.jpg");
    assert.equal(shifted1.group_position, 1);

    const shifted2 = db
      .prepare("SELECT group_position FROM photos WHERE filename = ?")
      .get("c.jpg");
    assert.equal(shifted2.group_position, 2);
  });

  it("returns 404 for missing photo", async () => {
    await request(app)
      .patch("/api/photos/99999/tag")
      .send({ tag: "love" })
      .expect(404);
  });

  it("returns 400 for invalid tag", async () => {
    const id = insertPhoto({ filename: "a.jpg" });

    await request(app)
      .patch(`/api/photos/${id}/tag`)
      .send({ tag: "invalid" })
      .expect(400);
  });
});

describe("PATCH /api/photos/:id/reorder", () => {
  beforeEach(clearPhotos);
  afterEach(clearPhotos);

  it("move photo down within group", async () => {
    const id1 = insertPhoto({
      filename: "a.jpg",
      tag: "love",
      group_position: 1,
    });
    const id2 = insertPhoto({
      filename: "b.jpg",
      tag: "love",
      group_position: 2,
    });
    const id3 = insertPhoto({
      filename: "c.jpg",
      tag: "love",
      group_position: 3,
    });

    // Move first to position 3
    const res = await request(app)
      .patch(`/api/photos/${id1}/reorder`)
      .send({ newPosition: 3 })
      .expect(200);

    assert.equal(res.body.group_position, 3);

    // Others should have shifted up
    const p2 = db
      .prepare("SELECT group_position FROM photos WHERE id = ?")
      .get(id2);
    const p3 = db
      .prepare("SELECT group_position FROM photos WHERE id = ?")
      .get(id3);
    assert.equal(p2.group_position, 1);
    assert.equal(p3.group_position, 2);
  });

  it("move photo up within group", async () => {
    const id1 = insertPhoto({
      filename: "a.jpg",
      tag: "love",
      group_position: 1,
    });
    const id2 = insertPhoto({
      filename: "b.jpg",
      tag: "love",
      group_position: 2,
    });
    const id3 = insertPhoto({
      filename: "c.jpg",
      tag: "love",
      group_position: 3,
    });

    // Move last to position 1
    const res = await request(app)
      .patch(`/api/photos/${id3}/reorder`)
      .send({ newPosition: 1 })
      .expect(200);

    assert.equal(res.body.group_position, 1);

    // Others should have shifted down
    const p1 = db
      .prepare("SELECT group_position FROM photos WHERE id = ?")
      .get(id1);
    const p2 = db
      .prepare("SELECT group_position FROM photos WHERE id = ?")
      .get(id2);
    assert.equal(p1.group_position, 2);
    assert.equal(p2.group_position, 3);
  });

  it("no-op when position unchanged", async () => {
    const id = insertPhoto({
      filename: "a.jpg",
      tag: "love",
      group_position: 2,
    });

    const res = await request(app)
      .patch(`/api/photos/${id}/reorder`)
      .send({ newPosition: 2 })
      .expect(200);

    assert.equal(res.body.group_position, 2);
  });

  it("returns 404 for missing photo", async () => {
    await request(app)
      .patch("/api/photos/99999/reorder")
      .send({ newPosition: 1 })
      .expect(404);
  });

  it("returns 400 for unrated photo", async () => {
    const id = insertPhoto({ filename: "a.jpg" });

    await request(app)
      .patch(`/api/photos/${id}/reorder`)
      .send({ newPosition: 1 })
      .expect(400);
  });
});

describe("GET /api/photos/:id/full", () => {
  beforeEach(clearPhotos);
  afterEach(clearPhotos);

  it("returns 404 for missing photo", async () => {
    await request(app).get("/api/photos/99999/full").expect(404);
  });
});
