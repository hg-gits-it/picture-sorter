# CLAUDE.md

Photo sorting app for ranking and organizing artwork photos for a Patrons' Show. Express backend with React frontend, SQLite storage.

## Commands

```bash
npm run dev          # Start server + client concurrently (dev mode)
npm run build        # Build client into client/dist/
npm start            # Start production server (API + frontend on port 3001)
npm run server       # Express server only (port 3001)
npm run client       # Vite dev server only (port 5173)
npm run lint         # ESLint across the project
npm test             # Run server tests (Node test runner)
```

## Tech Stack

- **Server:** Express 4, better-sqlite3, Sharp (thumbnails), ES modules
- **Client:** React 18, Vite 5, no component library, no CSS framework
- **Database:** SQLite (WAL mode) at `data/picture-sorter.db`
- **Testing:** Node built-in test runner + Supertest (`server/routes/photos.test.js`)
- **Linting:** ESLint 9 flat config (`eslint.config.js`)

## Project Structure

```
server/
  index.js            # Express app, route mounting
  db.js               # SQLite connection, schema, migrations
  routes/
    photos.js         # Core CRUD: list, tag, reorder, serve full image
    scan.js           # Filesystem scan + thumbnail generation (Sharp)
    submit.js         # SSE streaming submission to external show API
    showtime.js       # Read-only showtime mode (take/restore artwork)
  utils/
    parseFlickrMeta.js  # Extract metadata from Flickr JSON sidecars

client/src/
  main.jsx            # Entry point, path-based routing (/ vs /showtime)
  App.jsx             # Main layout, tag group rendering
  api/photos.js       # All fetch wrappers + URL builders
  context/
    PhotoContext.jsx   # useReducer state, debounced search, memoized actions
  components/
    PhotoGrid.jsx     # Drag-and-drop reordering grid
    PhotoCard.jsx     # Photo card with tag buttons + editable position
    TagGroup.jsx      # Section wrapper for one tag group
    FilterBar.jsx     # Tag filter buttons, search input, toggles
    PhotoModal.jsx    # Full-size preview with prev/next navigation
    SubmitModal.jsx   # SSE-based submission UI with progress log
    ShowtimePage.jsx  # Standalone showtime claiming interface
    UnratedSection.jsx # Non-draggable grid for unrated photos
  styles/app.css      # Single CSS file, dark theme
```

## API Endpoints

| Method  | Path                                     | Purpose                                          |
| ------- | ---------------------------------------- | ------------------------------------------------ |
| `GET`   | `/api/photos?tag=&search=&hideClaimed=1` | List photos with computed global rank + counts   |
| `PATCH` | `/api/photos/:id/tag`                    | Set/clear tag (body: `{tag}`)                    |
| `PATCH` | `/api/photos/:id/reorder`                | Reorder within tag group (body: `{newPosition}`) |
| `GET`   | `/api/photos/:id/full`                   | Serve full-size image                            |
| `POST`  | `/api/scan`                              | Trigger filesystem scan                          |
| `GET`   | `/api/showtime/photos`                   | List photos for showtime mode                    |
| `PATCH` | `/api/showtime/photos/:id/take`          | Mark artwork as claimed                          |
| `PATCH` | `/api/showtime/photos/:id/restore`       | Restore claimed artwork                          |
| `POST`  | `/api/submit`                            | SSE stream: submit rankings to show website      |

## Tag System

Five tag values with priority ordering for global rank: `love`(1) > `like`(2) > `meh`(3) > `tax_deduction`(4) > `unrated`(no rank).

Global rank is computed at query time via SQL CASE expressions in `server/routes/photos.js:38-51` — not stored. `group_position` tracks order within each tag group. Tag mutations use transactions to recompact positions (`server/routes/photos.js:96-143`).

## Database

Single `photos` table with columns: `id`, `filename` (unique), `tag` (CHECK constraint), `group_position`, `taken`, `show_id`, `artist`, `title`, `medium`, `dimensions`, `flickr_id`, `created_at`.

Migrations run on startup in `server/db.js:27-70` — forward-only, checking `sqlite_master` before each change.

## Photo Sources

Photos are scanned from `photos/` directory. Metadata is read from Flickr JSON sidecar files (`.json` next to each image) via `server/utils/parseFlickrMeta.js`. Thumbnails (300x300) are generated into `data/thumbnails/`.

## Adding New Features or Fixing Bugs

**IMPORTANT**: When you work on a new feature or bug, create a git branch first. Then work on changes in that branch for the remainder of the session.

## Additional Documentation

- [Architectural Patterns](.claude/docs/architectural_patterns.md) — database access patterns, API conventions, state management, drag-and-drop implementation, tag priority system, dev/prod serving strategy
