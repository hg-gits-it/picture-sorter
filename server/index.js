import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import SqliteStore from 'better-sqlite3-session-store';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import authRouter from './routes/auth.js';
import photosRouter from './routes/photos.js';
import submitRouter from './routes/submit.js';
import showtimeRouter from './routes/showtime.js';
import scanRouter from './routes/scan.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR || resolve(__dirname, '..', 'data', 'thumbnails');

// Crash on missing session secret in production
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is required in production');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_DIST = resolve(__dirname, '..', 'client', 'dist');

// Trust proxy (Caddy terminates TLS)
app.set('trust proxy', 1);

// Lock down CORS: disabled in production (same-origin via Caddy), allow Vite dev server in dev
app.use(cors({
  origin: isProduction ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json());

// Session middleware
const BetterSqliteStore = SqliteStore(session);
app.use(session({
  store: new BetterSqliteStore({ client: db, expired: { clear: true, intervalMs: 900000 } }),
  secret: process.env.SESSION_SECRET || 'picture-sorter-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.SECURE_COOKIE === 'true',
  },
}));

// Serve thumbnails as static files
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/photos', requireAuth, photosRouter);
app.use('/api/submit', requireAdmin, submitRouter);
app.use('/api/showtime/photos', requireAdmin, showtimeRouter);
app.use('/api/scan', requireAdmin, scanRouter);

// Serve built frontend
app.use(express.static(CLIENT_DIST));
app.get('*', (req, res) => {
  res.sendFile(resolve(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
