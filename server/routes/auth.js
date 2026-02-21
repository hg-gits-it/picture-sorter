import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import db from '../db.js';

const router = Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username.length < 1 || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = bcryptjs.hashSync(password, 10);

  // First user is auto-admin
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const isAdmin = userCount === 0 ? 1 : 0;

  const result = db.prepare(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
  ).run(username, hash, isAdmin);

  req.session.userId = result.lastInsertRowid;
  req.session.isAdmin = isAdmin === 1;

  res.status(201).json({
    id: result.lastInsertRowid,
    username,
    isAdmin: isAdmin === 1,
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcryptjs.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
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

export default router;
