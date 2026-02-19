/**
 * Parse a photo filename in the format:
 *   NNN--artist-name--title--medium--dimensions_flickrid_o.ext
 *
 * Hyphens within segments are word separators. Double-hyphens (--) are field separators.
 * Medium may span multiple segments (e.g. "oil--collage"). We scan from right-to-left
 * using a known-medium list to collect all medium segments, then treat the rest as title.
 */

const KNOWN_MEDIUMS = new Set([
  'acrylic', 'ceramic', 'charcoal', 'collage', 'etching', 'fiber', 'glass',
  'hand-engraved-glass', 'ink', 'mixed-media', 'oil', 'oil-pastel', 'pastel',
  'photography', 'photography-on-metal', 'printmaking', 'silkscreen',
  'trois-crayon', 'watercolor', 'clay', 'bottle-caps', 'watercolor-prints',
  'cherry-frame',
]);

export function parseFilename(filename) {
  // Strip extension
  const base = filename.replace(/\.[^.]+$/, '');

  // Split on '--'
  const parts = base.split('--');

  if (parts.length < 5) {
    return { number: null, artist: null, title: filename, medium: null, dimensions: null };
  }

  const number = parts[0].trim();
  const artist = toTitleCase(parts[1]);

  // Last segment contains dimensions + flickr ID
  const lastPart = parts[parts.length - 1];
  const dimensions = parseDimensions(lastPart);

  // Middle segments (between artist and dimensions) contain title + medium
  const middle = parts.slice(2, parts.length - 1);

  // Scan from the right of middle to collect medium segments
  let mediumStart = middle.length - 1;
  const mediumParts = [];
  for (let i = middle.length - 1; i >= 1; i--) {
    if (KNOWN_MEDIUMS.has(middle[i])) {
      mediumParts.unshift(middle[i]);
      mediumStart = i;
    } else {
      break;
    }
  }

  // If no known medium found scanning right, fall back to last middle segment
  if (mediumParts.length === 0) {
    mediumParts.push(middle[middle.length - 1]);
    mediumStart = middle.length - 1;
  }

  const titleParts = middle.slice(0, mediumStart);
  const title = toTitleCase(titleParts.join(' - '));
  const medium = mediumParts.map(toTitleCase).join(', ');

  return { number, artist, title, medium, dimensions };
}

function toTitleCase(str) {
  return str
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function parseDimensions(str) {
  const match = str.match(/^(\d+)x(\d+)/);
  if (!match) return str;
  return `${match[1]}" x ${match[2]}"`;
}
