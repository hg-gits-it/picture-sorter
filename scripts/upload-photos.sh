#!/bin/bash
set -eu

PHOTOS_DIR="flickr/theartleaguegallery/Albums"

# Find the album folder
ALBUM=$(ls -d "$PHOTOS_DIR"/*/ 2>/dev/null | head -1)
if [ -z "$ALBUM" ]; then
  echo "ERROR: No album folder found in $PHOTOS_DIR"
  exit 1
fi
echo "Found album: $ALBUM"

FILE_COUNT=$(ls "$ALBUM" | wc -l | tr -d ' ')
echo "Files to upload: $FILE_COUNT"

# Get connection details
read -p "Instance IP: " IP
read -p "SSH key name: " KEY_NAME

KEY_PATH="$HOME/.ssh/$KEY_NAME"

if [ ! -f "$KEY_PATH" ]; then
  echo "ERROR: SSH key not found at $KEY_PATH"
  exit 1
fi

echo "Uploading photos to $IP:/mnt/data/photos/ ..."
rsync -avz --progress -e "ssh -i $KEY_PATH -o StrictHostKeyChecking=no" \
  "$ALBUM" "ubuntu@$IP:/mnt/data/photos/" \
  --copy-links

echo ""
echo "Upload complete. Trigger a scan from the app to import the photos."
