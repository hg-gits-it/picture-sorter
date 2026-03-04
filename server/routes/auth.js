import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export function createAuthRouter() {
  const router = Router();

  // Rate limiters
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later' },
  });

  const setupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many setup attempts, please try again later' },
  });

  // GET /api/auth/setup-status — check if any users exist
  router.get('/setup-status', (req, res) => {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    res.json({ needsSetup: count === 0 });
  });

  // POST /api/auth/setup — create initial admin (only when 0 users exist)
  router.post('/setup', setupLimiter, (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    if (userCount > 0) {
      return res.status(403).json({ error: 'Setup already completed' });
    }

    const hash = bcryptjs.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)',
    ).run(username, hash);

    req.session.userId = result.lastInsertRowid;
    req.session.isAdmin = true;

    res.status(201).json({
      id: result.lastInsertRowid,
      username,
      isAdmin: true,
    });
  });

  // POST /api/auth/login — login (sets password on first login for admin-created users)
  router.post('/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // First login: password_hash is NULL, set it now
    if (user.password_hash === null) {
      if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }
      const hash = bcryptjs.hashSync(password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    } else {
      if (!bcryptjs.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
    }

    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin === 1;

    res.json({
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1,
    });
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });

  // GET /api/auth/me
  router.get('/me', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1,
    });
  });

  // GET /api/auth/users — admin only, list all users
  router.get('/users', requireAuth, requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, username, is_admin, created_at FROM users').all();
    res.json(users.map((u) => ({
      id: u.id,
      username: u.username,
      isAdmin: u.is_admin === 1,
      createdAt: u.created_at,
    })));
  });

  // POST /api/auth/users — admin only, create user (no password)
  router.post('/users', requireAuth, requireAdmin, (req, res) => {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const result = db.prepare(
      'INSERT INTO users (username, password_hash, is_admin) VALUES (?, NULL, 0)',
    ).run(username);

    res.status(201).json({
      id: result.lastInsertRowid,
      username,
      isAdmin: false,
    });
  });

  // DELETE /api/auth/users/:id — admin only, delete non-admin user
  router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
    const userId = Number(req.params.id);

    const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.is_admin === 1) {
      return res.status(403).json({ error: 'Cannot delete admin user' });
    }

    db.prepare('DELETE FROM user_ratings WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ ok: true });
  });

  return router;
}

// Default export for production use
export default createAuthRouter();
