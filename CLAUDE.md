# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev          # Start both server and client concurrently (dev mode)
npm run build        # Build client into client/dist/
npm start            # Start production server (serves API + built frontend on port 3001)
npm run server       # Start Express server only (port 3001)
npm run client       # Start Vite dev server only (port 5173)
npm run lint         # Run ESLint across the project
```

## Architecture

Full-stack photo sorting app: Express backend + React frontend with SQLite storage.

**Server (port 3001):** Express with ES modules, better-sqlite3 for database, Sharp for thumbnail generation. Scans `photos/` directory for JPEGs on startup and via `POST /api/scan`. Generates 300x300 thumbnails into `data/thumbnails/`. In production, also serves the built frontend from `client/dist/`.

**Client (port 5173 in dev):** React 18 + Vite. In dev mode, proxies `/api` and `/thumbnails` to the backend. In production, built into `client/dist/` and served by Express. State managed via React Context + useReducer in `PhotoContext.jsx`. HTML5 drag-and-drop for reordering (no external library).

**API endpoints:**
- `GET /api/photos?tag=&search=` — list with computed global rank and count badges
- `PATCH /api/photos/:id/tag` — set/clear tag, auto-manages group_position
- `PATCH /api/photos/:id/reorder` — reorder within tag group
- `GET /api/photos/:id/full` — serve full-size image
- `POST /api/scan` — trigger filesystem scan

## Tag System

Four tags with priority ordering for global rank computation:
1. `love` (highest priority)
2. `like`
3. `meh`
4. `tax_deduction` (lowest priority)
5. `null` — unranked (no global rank)

Global rank is computed at query time via SQL CASE expressions, not stored. `group_position` tracks order within each tag group. Tag mutations use transactions to recompact positions.

## Database

SQLite at `data/picture-sorter.db` (WAL mode). Single `photos` table:
- `id`, `filename` (unique), `tag` (CHECK constraint), `group_position`, `created_at`
- Migration logic in `db.js` handles schema changes (recreates table if CHECK constraint is outdated)

## Filename Convention

Photos follow the format: `NNN--artist-name--title--medium--dimensions_flickrid_o.ext`

`--` separates fields; `-` separates words within fields. The parser in `utils/parseFilename.js` extracts number, artist, title, medium, and dimensions. It uses a known-medium set to correctly handle multi-medium artworks (e.g., `oil--collage` → "Oil, Collage").

## Key Conventions

- Both server and client use ES modules (`"type": "module"`)
- Server uses synchronous better-sqlite3 with prepared statements and transactions
- Frontend search input is debounced (300ms)
- Thumbnails share the source filename (1:1 mapping in `data/thumbnails/`)
- `.gitignore` excludes `photos/`, `data/picture-sorter.db`, `data/thumbnails/`, `dist/`
