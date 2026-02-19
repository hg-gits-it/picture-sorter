const API_BASE = '/api';

export async function fetchPhotos({ tag, search } = {}) {
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (search) params.set('search', search);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/photos${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error('Failed to fetch photos');
  return res.json();
}

export async function tagPhoto(id, tag) {
  const res = await fetch(`${API_BASE}/photos/${id}/tag`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  });
  if (!res.ok) throw new Error('Failed to tag photo');
  return res.json();
}

export async function reorderPhoto(id, newPosition) {
  const res = await fetch(`${API_BASE}/photos/${id}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPosition }),
  });
  if (!res.ok) throw new Error('Failed to reorder photo');
  return res.json();
}

export async function triggerScan() {
  const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
  if (!res.ok) throw new Error('Scan failed');
  return res.json();
}

export function thumbnailUrl(filename) {
  return `/thumbnails/${encodeURIComponent(filename)}`;
}

export function fullImageUrl(id) {
  return `${API_BASE}/photos/${id}/full`;
}
