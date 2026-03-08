# Architectural Patterns

## Database Access: Synchronous Prepared Statements + Transactions

All database access uses better-sqlite3's synchronous API. Queries always use parameterized prepared statements — never string interpolation.

Multi-step mutations (tag changes, reordering) are wrapped in `db.transaction()` to ensure atomicity. The transaction function is defined, then called separately. See `server/routes/photos.js:96-143` (tag mutation) and `server/routes/photos.js:164-187` (reorder) for examples.

Schema migrations run on startup in `server/db.js:27-70`. Each migration checks `sqlite_master` for the current schema before applying changes. There are no down migrations — changes are forward-only.

## API Design: REST + JSON + SSE for Streaming

Routes follow REST conventions with Express Router. Each route file exports a single router instance (`server/routes/photos.js:9`, `server/routes/showtime.js`, `server/routes/submit.js`).

Response format conventions:
- List endpoints return `{ photos, counts }` — see `server/routes/photos.js:80`
- Mutation endpoints return the updated entity — see `server/routes/photos.js:147-148`
- Errors return `{ error: "message" }` with appropriate status codes — see `server/routes/photos.js:89,93`

For long-running operations, the submit route uses Server-Sent Events (SSE) instead of request/response. The client connects via `EventSource` — see `server/routes/submit.js` and `client/src/components/SubmitModal.jsx`.

## Client State: Context + useReducer

All shared UI state lives in a single React Context with useReducer (`client/src/context/PhotoContext.jsx:4-33`). The reducer handles 6 action types for photos, filters, search, and selection state.

The provider exposes memoized callbacks via `useCallback` that dispatch actions and call the API (`client/src/context/PhotoContext.jsx:67-96`). Components access state through a custom `usePhotos()` hook (`client/src/context/PhotoContext.jsx:117-121`).

Search input is debounced at 300ms using `useRef` + `setTimeout` (`client/src/context/PhotoContext.jsx:59-65`). Filter and hideClaimed changes trigger immediate reloads (`client/src/context/PhotoContext.jsx:54-56`).

## Client API Layer: Thin Fetch Wrappers

All server communication goes through `client/src/api/photos.js`. Each function is a thin wrapper around `fetch` that:
1. Builds the URL with query params or path segments
2. Calls `fetch` with appropriate method/headers/body
3. Checks `res.ok` and throws on failure
4. Returns `res.json()`

URL builder functions (`thumbnailUrl`, `fullImageUrl`, `submitUrl`) are co-located with fetch functions so all API knowledge stays in one file.

## Drag-and-Drop: Native HTML5, No Library

Reordering uses the browser's native drag-and-drop API with `useRef` to track the dragged item (`client/src/components/PhotoGrid.jsx`). The drag source sets `effectAllowed: 'move'`, and drop targets call the `reorderPhoto` API with the target's `group_position`. The server handles position shifting in a transaction.

## Tag Priority System: Computed at Query Time

Tags have a fixed priority order: love(1) > like(2) > meh(3) > pass(4) > unrated(5). Global rank is computed in SQL using nested CASE expressions rather than stored (`server/routes/photos.js:38-51`). This avoids stale rank data and keeps the source of truth in one place.

When changing tags, the direction matters: demoting (higher to lower priority) inserts at position 1; promoting or newly rating appends to the end (`server/routes/photos.js:110-132`).

## Dev/Prod Serving: Vite Proxy vs Express Static

In development, Vite proxies `/api` and `/thumbnails` to the Express backend (`client/vite.config.js`). In production, Express serves the built frontend from `client/dist/` with an SPA catch-all route (`server/index.js:40-43`).

## ES Modules Throughout

Both server and client use ES modules (`"type": "module"` in both `package.json` files). The server uses the `fileURLToPath(import.meta.url)` pattern for `__dirname` equivalence — see `server/index.js:10`, `server/routes/photos.js:6`, `server/db.js:6`.
