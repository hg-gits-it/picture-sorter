const API_BASE = '/api';

const fetchOpts = { credentials: 'include' };

// Auth API
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  return res.json();
}

export async function setup(username, password) {
  const res = await fetch(`${API_BASE}/auth/setup`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Setup failed');
  }
  return res.json();
}

export async function fetchSetupStatus() {
  const res = await fetch(`${API_BASE}/auth/setup-status`, fetchOpts);
  if (!res.ok) throw new Error('Failed to fetch setup status');
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/auth/users`, fetchOpts);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(username) {
  const res = await fetch(`${API_BASE}/auth/users`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create user');
  }
  return res.json();
}

export async function deleteUser(id) {
  const res = await fetch(`${API_BASE}/auth/users/${id}`, {
    ...fetchOpts,
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete user');
  }
  return res.json();
}

export async function logout() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    ...fetchOpts,
    method: 'POST',
  });
  if (!res.ok) throw new Error('Logout failed');
  return res.json();
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/auth/me`, fetchOpts);
  if (!res.ok) return null;
  return res.json();
}

// Photos API
export async function fetchPhotos({ tag, search, hideClaimed } = {}) {
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (search) params.set('search', search);
  if (hideClaimed) params.set('hideClaimed', '1');
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/photos${qs ? '?' + qs : ''}`, fetchOpts);
  if (!res.ok) throw new Error('Failed to fetch photos');
  return res.json();
}

export async function tagPhoto(id, tag) {
  const res = await fetch(`${API_BASE}/photos/${id}/tag`, {
    ...fetchOpts,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  });
  if (!res.ok) throw new Error('Failed to tag photo');
  return res.json();
}

export async function reorderPhoto(id, newPosition) {
  const res = await fetch(`${API_BASE}/photos/${id}/reorder`, {
    ...fetchOpts,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPosition }),
  });
  if (!res.ok) throw new Error('Failed to reorder photo');
  return res.json();
}

export function thumbnailUrl(flickrId) {
  return `/thumbnails/${encodeURIComponent(flickrId)}.jpg`;
}

export function fullImageUrl(id) {
  return `${API_BASE}/photos/${id}/full`;
}

// Scan API
export async function triggerScan() {
  const res = await fetch(`${API_BASE}/scan`, { ...fetchOpts, method: 'POST' });
  if (!res.ok) throw new Error('Scan failed');
  return res.json();
}


// Submit API
export function submitUrl(codename) {
  return `${API_BASE}/submit?codename=${encodeURIComponent(codename)}`;
}

// Showtime API
export async function fetchShowtimePhotos() {
  const res = await fetch(`${API_BASE}/showtime/photos`, fetchOpts);
  if (!res.ok) throw new Error('Failed to fetch showtime photos');
  return res.json();
}

export async function takePhoto(id) {
  const res = await fetch(`${API_BASE}/showtime/photos/${id}/take`, {
    ...fetchOpts,
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
    ...fetchOpts,
    method: 'PATCH',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to restore photo');
  }
  return res.json();
}
