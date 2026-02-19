const API_BASE = '/api';

export async function fetchPhotos({ tag, search, hideClaimed } = {}) {
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (search) params.set('search', search);
  if (hideClaimed) params.set('hideClaimed', '1');
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

export function thumbnailUrl(flickrId) {
  return `/thumbnails/${encodeURIComponent(flickrId)}.jpg`;
}

export function fullImageUrl(id) {
  return `${API_BASE}/photos/${id}/full`;
}

export function submitUrl(codename) {
  return `${API_BASE}/submit?codename=${encodeURIComponent(codename)}`;
}

export async function fetchShowtimePhotos() {
  const res = await fetch(`${API_BASE}/showtime/photos`);
  if (!res.ok) throw new Error('Failed to fetch showtime photos');
  return res.json();
}

export async function takePhoto(id) {
  const res = await fetch(`${API_BASE}/showtime/photos/${id}/take`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to take photo');
  }
  return res.json();
}

export async function restorePhoto(id) {
  const res = await fetch(`${API_BASE}/showtime/photos/${id}/restore`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to restore photo');
  }
  return res.json();
}
