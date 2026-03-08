#!/bin/bash
# Download all photos from the Flickr album.
# Usage: ./scripts/download-flickr-album.sh
#
# Re-run safe: gallery-dl skips already-downloaded files.
# Requires: gallery-dl (brew install gallery-dl)

set -e

ALBUM_URL="https://www.flickr.com/photos/theartleague/albums/72177720331330186"

echo "=== Downloading photos from Flickr album ==="
echo "This may take a while for 600+ photos..."
echo ""
gallery-dl --write-metadata --sleep 2.0 --sleep-request 2.0 --sleep-429 60 -d . "$ALBUM_URL"

echo ""
echo "=== Done ==="
