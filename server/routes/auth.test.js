import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import db from '../db.js';
import authRouter from './auth.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  }));
  app.use('/api/auth', authRouter);
  return app;
}

function clearUsers() {
  db.prepare('DELETE FROM users').run();
}

describe('POST /api/auth/register', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('registers a new user', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass1234' })
      .expect(201);

    assert.equal(res.body.username, 'alice');
    assert.ok(res.body.id);
  });

  it('first user is auto-admin', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'firstuser', password: 'pass1234' })
      .expect(201);

    assert.equal(res.body.isAdmin, true);
  });

  it('second user is not admin', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'firstuser', password: 'pass1234' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'seconduser', password: 'pass1234' })
      .expect(201);

    assert.equal(res.body.isAdmin, false);
  });

  it('rejects duplicate username', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass1234' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'different' })
      .expect(409);
  });

  it('rejects missing credentials', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/register')
      .send({})
      .expect(400);
  });

  it('rejects short password', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'ab' })
      .expect(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('logs in with valid credentials', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass1234' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'pass1234' })
      .expect(200);

    assert.equal(res.body.username, 'alice');
  });

  it('rejects invalid password', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass1234' });

    await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrong' })
      .expect(401);
  });

  it('rejects non-existent user', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'pass1234' })
      .expect(401);
  });

  it('rejects missing credentials', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('returns 401 when not authenticated', async () => {
    const app = createApp();
    await request(app)
      .get('/api/auth/me')
      .expect(401);
  });

  it('returns user when authenticated via session', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass1234' })
      .expect(201);

    const res = await agent.get('/api/auth/me').expect(200);

    assert.equal(res.body.username, 'alice');
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('destroys session', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass1234' });

    await agent.post('/api/auth/logout').expect(200);

    await agent.get('/api/auth/me').expect(401);
  });
});
