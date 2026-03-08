# Art Sorter

A photo sorting app for ranking and organizing artwork. Tag artwork with ratings, drag-and-drop to reorder within groups, and submit final rankings to the show website.

## Tech Stack

- **Server:** Express, better-sqlite3, Sharp (thumbnail generation)
- **Client:** React 18, Vite
- **Database:** SQLite (WAL mode)

## Prerequisites

- Node.js

## Setup

```bash
npm install
cd server && npm install
cd ../client && npm install
```

Use `scripts/download-flickr-album.sh` to download artworks from flickr. Move photos downloaded into a `photos/` directory at the project root. Include the flickr JSON sidecar files (`.json` next to each image) as these are used for metadata extraction.

## Running Locally

```bash
# Development (server + client with hot reload)
npm run dev

# Production
npm run build
npm start
```

- Dev mode: API on port 3001, Vite dev server on port 5173
- Production: both served on port 3001

```bash
# Docker
docker build -t art-sorter .
docker run -p 3001:3001 -v ./photos:/app/photos -v ./data:/app/data art-sorter
```

## Testing

```bash
# Run all tests (server + client)
npm test

# Server tests only
cd server && DB_PATH=../data/test.db node --test --test-concurrency=1

# Client tests only
cd client && npx vitest run
```

## Linting

```bash
npm run lint
```

## Deployment

The app runs on AWS Lightsail, deployed via GitHub Actions.

### 1. Provision infrastructure

Run the **Manage Infrastructure** workflow (`.github/workflows/infra.yml`) from GitHub Actions with `action: create`. For the first deployment, set `CreateNewDisk: yes`. For subsequent seasons, use `CreateNewDisk: no` to reattach the existing data disk.

Note the static IP from the workflow output.

### 2. Update DNS

Manually update the A record for `artsorter.com` to point to the new Lightsail static IP.

### 3. Deploy the application

The **Deploy to Lightsail** workflow (`.github/workflows/deploy.yml`) runs automatically on push to `master`, or can be triggered manually from GitHub Actions.

### 4. Upload photos

```bash
scripts/upload-photos.sh
```

This uploads photos from the local `flickr/` directory to the server via rsync. You'll be prompted for the instance IP and SSH key name. After uploading, trigger a scan from the app as the admin user to import the photos.

### End of season

Run the **Manage Infrastructure** workflow with `action: delete` to tear down the server. The data disk is retained automatically for next season.
