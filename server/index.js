import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import photosRouter from './routes/photos.js';
import submitRouter from './routes/submit.js';
import showtimeRouter from './routes/showtime.js';
import scanRouter from './routes/scan.js';

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
app.use('/api/submit', submitRouter);
app.use('/api/showtime/photos', showtimeRouter);
app.use('/api/scan', scanRouter);

// Serve built frontend
app.use(express.static(CLIENT_DIST));
app.get('*', (req, res) => {
  res.sendFile(resolve(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
