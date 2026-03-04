import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import db from '../db.js';
import { createAuthRouter } from './auth.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  }));
  app.use('/api/auth', createAuthRouter());
  return app;
}

function clearUsers() {
  db.prepare('DELETE FROM user_ratings').run();
  db.prepare('DELETE FROM users').run();
}

describe('GET /api/auth/setup-status', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('returns needsSetup true when no users', async () => {
    const app = createApp();
    const res = await request(app).get('/api/auth/setup-status').expect(200);
    assert.equal(res.body.needsSetup, true);
  });

  it('returns needsSetup false when users exist', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });
    const res = await request(app).get('/api/auth/setup-status').expect(200);
    assert.equal(res.body.needsSetup, false);
  });
});

describe('POST /api/auth/setup', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('creates initial admin user', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' })
      .expect(201);

    assert.equal(res.body.username, 'admin');
    assert.equal(res.body.isAdmin, true);
  });

  it('rejects when users already exist', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    await request(app)
      .post('/api/auth/setup')
      .send({ username: 'another', password: 'pass1234' })
      .expect(403);
  });

  it('rejects missing credentials', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/setup')
      .send({})
      .expect(400);
  });

  it('rejects short password', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'ab' })
      .expect(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('logs in with valid credentials', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin1234' })
      .expect(200);

    assert.equal(res.body.username, 'admin');
  });

  it('rejects invalid password', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' })
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

  it('sets password on first login for admin-created user', async () => {
    const app = createApp();
    const agent = request.agent(app);

    // Setup admin
    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    // Admin creates user (no password)
    await agent
      .post('/api/auth/users')
      .send({ username: 'newuser' })
      .expect(201);

    // First login sets password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'newuser', password: 'mypassword' })
      .expect(200);

    assert.equal(loginRes.body.username, 'newuser');

    // Can login again with the same password
    await request(app)
      .post('/api/auth/login')
      .send({ username: 'newuser', password: 'mypassword' })
      .expect(200);

    // Wrong password now fails
    await request(app)
      .post('/api/auth/login')
      .send({ username: 'newuser', password: 'different' })
      .expect(401);
  });

  it('rejects short password on first login', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    await agent
      .post('/api/auth/users')
      .send({ username: 'newuser' });

    await request(app)
      .post('/api/auth/login')
      .send({ username: 'newuser', password: 'ab' })
      .expect(400);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('returns 401 when not authenticated', async () => {
    const app = createApp();
    await request(app).get('/api/auth/me').expect(401);
  });

  it('returns user when authenticated via session', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    const res = await agent.get('/api/auth/me').expect(200);
    assert.equal(res.body.username, 'admin');
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('destroys session', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('GET /api/auth/users (admin)', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('returns list of users for admin', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    const res = await agent.get('/api/auth/users').expect(200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].username, 'admin');
  });

  it('rejects unauthenticated request', async () => {
    const app = createApp();
    await request(app).get('/api/auth/users').expect(401);
  });
});

describe('POST /api/auth/users (admin create user)', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('creates user without password', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    const res = await agent
      .post('/api/auth/users')
      .send({ username: 'newuser' })
      .expect(201);

    assert.equal(res.body.username, 'newuser');
    assert.equal(res.body.isAdmin, false);
  });

  it('rejects duplicate username', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    await agent
      .post('/api/auth/users')
      .send({ username: 'newuser' });

    await agent
      .post('/api/auth/users')
      .send({ username: 'newuser' })
      .expect(409);
  });

  it('rejects missing username', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    await agent
      .post('/api/auth/users')
      .send({})
      .expect(400);
  });

  it('rejects unauthenticated request', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/users')
      .send({ username: 'newuser' })
      .expect(401);
  });
});

describe('DELETE /api/auth/users/:id (admin delete user)', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('deletes non-admin user', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    const createRes = await agent
      .post('/api/auth/users')
      .send({ username: 'todelete' });

    await agent
      .delete(`/api/auth/users/${createRes.body.id}`)
      .expect(200);

    const listRes = await agent.get('/api/auth/users');
    assert.equal(listRes.body.length, 1);
  });

  it('refuses to delete admin user', async () => {
    const app = createApp();
    const agent = request.agent(app);

    const setupRes = await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    await agent
      .delete(`/api/auth/users/${setupRes.body.id}`)
      .expect(403);
  });

  it('returns 404 for non-existent user', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' });

    await agent
      .delete('/api/auth/users/99999')
      .expect(404);
  });
});

describe('Rate limiting', () => {
  beforeEach(clearUsers);
  afterEach(clearUsers);

  it('rate limits login after 5 attempts', async () => {
    const app = createApp();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'wrong' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'wrong' })
      .expect(429);

    assert.ok(res.body.error.includes('Too many'));
  });

  it('rate limits setup after 3 attempts', async () => {
    const app = createApp();

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/setup')
        .send({ username: `admin${i}`, password: 'admin1234' });
      clearUsers(); // so setup can be attempted again
    }

    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'admin1234' })
      .expect(429);

    assert.ok(res.body.error.includes('Too many'));
  });
});
