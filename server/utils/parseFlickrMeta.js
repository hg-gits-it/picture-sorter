/**
 * Parse metadata from a Flickr JSON sidecar's title field.
 * Format: "NNN | Artist Name | Title | Medium | Dimensions"
 * Medium may span multiple pipe-separated segments (e.g. "Oil | Collage").
 *
 * Returns { number, artist, title, medium, dimensions } with original casing.
 */

export function parseFlickrMeta(title) {
  if (!title) {
    return { number: null, artist: null, title: null, medium: null, dimensions: null };
  }

  const parts = title.split('|').map(s => s.trim());

  if (parts.length < 5) {
    return { number: null, artist: null, title, medium: null, dimensions: null };
  }

  const number = parts[0].padStart(3, '0');
  const artist = parts[1];
  const artTitle = parts[2];
  const dimensions = parts[parts.length - 1];
  const medium = parts.slice(3, parts.length - 1).join(', ');

  return { number, artist, title: artTitle, medium, dimensions };
}
