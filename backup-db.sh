#!/bin/bash
# Safely back up the SQLite database by flushing the WAL first.
# Usage: ./backup-db.sh [backup-name]
#
# The server should be stopped before running this.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB="$SCRIPT_DIR/data/picture-sorter.db"
NAME="${1:-backup-$(date +%Y%m%d-%H%M%S)}"
DEST="$SCRIPT_DIR/data/picture-sorter-${NAME}.db"

if [ ! -f "$DB" ]; then
  echo "Error: Database not found at $DB"
  exit 1
fi

# Flush WAL into main DB file so the backup is a single self-contained file
sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);"

cp "$DB" "$DEST"
echo "Backed up to: $DEST"
echo "Rows: $(sqlite3 "$DEST" 'SELECT COUNT(*) FROM photos;')"
echo "Tagged: $(sqlite3 "$DEST" 'SELECT COUNT(*) FROM photos WHERE tag IS NOT NULL;')"
