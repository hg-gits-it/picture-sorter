import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import photosRouter from './routes/photos.js';
import { scanPhotos } from './scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THUMBNAILS_DIR = resolve(__dirname, '..', 'data', 'thumbnails');

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_DIST = resolve(__dirname, '..', 'client', 'dist');

app.use(cors());
app.use(express.json());

// Serve thumbnails as static files
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

// API routes
app.use('/api/photos', photosRouter);

// Scan endpoint
app.post('/api/scan', async (req, res) => {
  try {
    const result = await scanPhotos();
    res.json(result);
  } catch (err) {
    console.error('Scan failed:', err);
    res.status(500).json({ error: 'Scan failed' });
  }
});

// Serve built frontend
app.use(express.static(CLIENT_DIST));
app.get('*', (req, res) => {
  res.sendFile(resolve(CLIENT_DIST, 'index.html'));
});

// Auto-scan on startup
scanPhotos()
  .then(result => console.log(`Startup scan complete: ${result.scanned} photos found`))
  .catch(err => console.error('Startup scan failed:', err));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
