/**
 * Reads gallery-dl downloaded photos + JSON metadata sidecars,
 * renames them per project convention:
 *   NNN--artist-name--title--medium--dimensions_flickrid_o.ext
 *
 * Usage: node rename-flickr-downloads.js <download-dir> <output-dir>
 */

import { readdirSync, readFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, extname, join } from 'path';

const [downloadDir, outputDir] = process.argv.slice(2);

if (!downloadDir || !outputDir) {
  console.error('Usage: node rename-flickr-downloads.js <download-dir> <output-dir>');
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

// Find all JSON metadata files recursively
function findJsonFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')          // remove apostrophes
    .replace(/[^a-z0-9]+/g, '-')   // non-alphanum to hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-|-$/g, '');        // trim leading/trailing hyphens
}

function parseTitle(title) {
  // Format: "NNN | Artist Name | Title | Medium | Dimensions"
  const parts = title.split('|').map(s => s.trim());

  if (parts.length < 5) {
    return null;
  }

  const number = parts[0].padStart(3, '0');
  const artist = slugify(parts[1]);
  const artTitle = slugify(parts[2]);
  // Medium may contain multiple parts if there were extra pipes
  const dimensions = slugify(parts[parts.length - 1]);
  const medium = parts.slice(3, parts.length - 1).map(slugify).join('--');

  return { number, artist, title: artTitle, medium, dimensions };
}

const jsonFiles = findJsonFiles(downloadDir);
let renamed = 0;
let skipped = 0;
let errors = 0;

for (const jsonFile of jsonFiles) {
  try {
    const meta = JSON.parse(readFileSync(jsonFile, 'utf8'));
    const imageFile = jsonFile.replace(/\.json$/, '');

    if (!existsSync(imageFile)) {
      continue;
    }

    const parsed = parseTitle(meta.title || '');
    if (!parsed) {
      console.warn(`  SKIP (can't parse title): ${meta.title}`);
      skipped++;
      continue;
    }

    const ext = extname(imageFile);
    const flickrId = meta.id;
    const newName = `${parsed.number}--${parsed.artist}--${parsed.title}--${parsed.medium}--${parsed.dimensions}_${flickrId}_o${ext}`;
    const destPath = resolve(outputDir, newName);

    if (existsSync(destPath)) {
      skipped++;
      continue;
    }

    copyFileSync(imageFile, destPath);
    renamed++;

    if (renamed % 50 === 0) {
      console.log(`  Processed ${renamed} photos...`);
    }
  } catch (err) {
    console.error(`  ERROR: ${jsonFile}: ${err.message}`);
    errors++;
  }
}

console.log(`\nComplete: ${renamed} renamed, ${skipped} skipped, ${errors} errors`);
