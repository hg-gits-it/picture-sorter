#!/bin/bash
# Download all photos from the Flickr album and rename per project convention.
# Usage: ./scripts/download-flickr-album.sh
#
# Re-run safe: gallery-dl skips already-downloaded files.
# Requires: gallery-dl (brew install gallery-dl)

set -e

ALBUM_URL="https://www.flickr.com/photos/theartleague/albums/72177720331330186"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PHOTOS_DIR="$PROJECT_DIR/photos"
TEMP_DIR="$PROJECT_DIR/.flickr-download"

mkdir -p "$PHOTOS_DIR" "$TEMP_DIR"

echo "=== Downloading photos from Flickr album ==="
echo "This may take a while for 600+ photos..."
echo "Rate-limited to 1 request/second to avoid Flickr throttling."
echo "Re-run this script if it gets rate-limited — it picks up where it left off."
echo ""
gallery-dl --write-metadata --sleep 1.5 --sleep-request 1.0 --sleep-429 60 -d "$TEMP_DIR" "$ALBUM_URL"

echo ""
echo "=== Renaming and moving photos ==="
node "$SCRIPT_DIR/rename-flickr-downloads.js" "$TEMP_DIR" "$PHOTOS_DIR"

echo ""
echo "=== Done ==="
echo "Photos are in: $PHOTOS_DIR"
echo "You can delete the temp directory: rm -rf $TEMP_DIR"
