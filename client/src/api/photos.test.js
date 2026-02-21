import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPhotos,
  tagPhoto,
  reorderPhoto,
  triggerScan,
  thumbnailUrl,
  fullImageUrl,
  submitUrl,
  fetchShowtimePhotos,
  takePhoto,
  restorePhoto,
  login,
  register,
  logout,
  fetchMe,
} from './photos.js';

function mockFetch(body, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetchPhotos', () => {
  it('fetches photos with no params', async () => {
    globalThis.fetch = mockFetch({ photos: [], counts: {} });

    const result = await fetchPhotos();

    expect(fetch).toHaveBeenCalledWith('/api/photos', { credentials: 'include' });
    expect(result).toEqual({ photos: [], counts: {} });
  });

  it('includes tag param', async () => {
    globalThis.fetch = mockFetch({ photos: [], counts: {} });

    await fetchPhotos({ tag: 'love' });

    expect(fetch).toHaveBeenCalledWith('/api/photos?tag=love', { credentials: 'include' });
  });

  it('includes search param', async () => {
    globalThis.fetch = mockFetch({ photos: [], counts: {} });

    await fetchPhotos({ search: 'sunset' });

    expect(fetch).toHaveBeenCalledWith('/api/photos?search=sunset', { credentials: 'include' });
  });

  it('includes hideClaimed param', async () => {
    globalThis.fetch = mockFetch({ photos: [], counts: {} });

    await fetchPhotos({ hideClaimed: true });

    expect(fetch).toHaveBeenCalledWith('/api/photos?hideClaimed=1', { credentials: 'include' });
  });

  it('includes all params together', async () => {
    globalThis.fetch = mockFetch({ photos: [], counts: {} });

    await fetchPhotos({ tag: 'love', search: 'test', hideClaimed: true });

    expect(fetch).toHaveBeenCalledWith(
      '/api/photos?tag=love&search=test&hideClaimed=1',
      { credentials: 'include' },
    );
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mockFetch({}, false, 500);

    await expect(fetchPhotos()).rejects.toThrow('Failed to fetch photos');
  });
});

describe('tagPhoto', () => {
  it('sends PATCH with tag in body', async () => {
    globalThis.fetch = mockFetch({ id: 1, tag: 'love' });

    const result = await tagPhoto(1, 'love');

    expect(fetch).toHaveBeenCalledWith('/api/photos/1/tag', {
      credentials: 'include',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'love' }),
    });
    expect(result.tag).toBe('love');
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mockFetch({}, false, 400);

    await expect(tagPhoto(1, 'invalid')).rejects.toThrow('Failed to tag photo');
  });
});

describe('reorderPhoto', () => {
  it('sends PATCH with newPosition in body', async () => {
    globalThis.fetch = mockFetch({ id: 1, group_position: 3 });

    const result = await reorderPhoto(1, 3);

    expect(fetch).toHaveBeenCalledWith('/api/photos/1/reorder', {
      credentials: 'include',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPosition: 3 }),
    });
    expect(result.group_position).toBe(3);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mockFetch({}, false, 400);

    await expect(reorderPhoto(1, 3)).rejects.toThrow('Failed to reorder photo');
  });
});

describe('thumbnailUrl', () => {
  it('builds thumbnail path from flickr ID', () => {
    expect(thumbnailUrl('12345')).toBe('/thumbnails/12345.jpg');
  });

  it('encodes special characters', () => {
    expect(thumbnailUrl('a/b')).toBe('/thumbnails/a%2Fb.jpg');
  });
});

describe('fullImageUrl', () => {
  it('builds full image path from photo ID', () => {
    expect(fullImageUrl(42)).toBe('/api/photos/42/full');
  });
});

describe('triggerScan', () => {
  it('sends POST to scan endpoint', async () => {
    globalThis.fetch = mockFetch({ scanned: 10 });

    const result = await triggerScan();

    expect(fetch).toHaveBeenCalledWith('/api/scan', { credentials: 'include', method: 'POST' });
    expect(result.scanned).toBe(10);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mockFetch({}, false, 500);

    await expect(triggerScan()).rejects.toThrow('Scan failed');
  });
});

describe('submitUrl', () => {
  it('builds submit URL with codename', () => {
    expect(submitUrl('testuser')).toBe('/api/submit?codename=testuser');
  });

  it('encodes special characters in codename', () => {
    expect(submitUrl('a b&c')).toBe('/api/submit?codename=a%20b%26c');
  });
});


describe('fetchShowtimePhotos', () => {
  it('fetches showtime photos', async () => {
    globalThis.fetch = mockFetch({ photos: [{ id: 1 }] });

    const result = await fetchShowtimePhotos();

    expect(fetch).toHaveBeenCalledWith('/api/showtime/photos', { credentials: 'include' });
    expect(result.photos).toHaveLength(1);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mockFetch({}, false, 500);

    await expect(fetchShowtimePhotos()).rejects.toThrow(
      'Failed to fetch showtime photos',
    );
  });
});

describe('takePhoto', () => {
  it('sends PATCH to take endpoint', async () => {
    globalThis.fetch = mockFetch({ id: 1, taken: 1 });

    const result = await takePhoto(1);

    expect(fetch).toHaveBeenCalledWith('/api/showtime/photos/1/take', {
      credentials: 'include',
      method: 'PATCH',
    });
    expect(result.taken).toBe(1);
  });

  it('throws with server error message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Photo is already taken' }),
    });

    await expect(takePhoto(1)).rejects.toThrow('Photo is already taken');
  });

  it('throws fallback message when no error in response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(takePhoto(1)).rejects.toThrow('Failed to take photo');
  });
});

describe('restorePhoto', () => {
  it('sends PATCH to restore endpoint', async () => {
    globalThis.fetch = mockFetch({ id: 1, taken: 0 });

    const result = await restorePhoto(1);

    expect(fetch).toHaveBeenCalledWith('/api/showtime/photos/1/restore', {
      credentials: 'include',
      method: 'PATCH',
    });
    expect(result.taken).toBe(0);
  });

  it('throws with server error message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Photo is not taken' }),
    });

    await expect(restorePhoto(1)).rejects.toThrow('Photo is not taken');
  });

  it('throws fallback message when no error in response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(restorePhoto(1)).rejects.toThrow('Failed to restore photo');
  });
});

describe('login', () => {
  it('sends POST with credentials', async () => {
    globalThis.fetch = mockFetch({ id: 1, username: 'alice', isAdmin: false });

    const result = await login('alice', 'pass');

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'pass' }),
    });
    expect(result.username).toBe('alice');
  });
});

describe('register', () => {
  it('sends POST with credentials', async () => {
    globalThis.fetch = mockFetch({ id: 1, username: 'bob', isAdmin: true });

    const result = await register('bob', 'pass');

    expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob', password: 'pass' }),
    });
    expect(result.isAdmin).toBe(true);
  });
});

describe('logout', () => {
  it('sends POST to logout', async () => {
    globalThis.fetch = mockFetch({ ok: true });

    await logout();

    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
      credentials: 'include',
      method: 'POST',
    });
  });
});

describe('fetchMe', () => {
  it('returns user data when authenticated', async () => {
    globalThis.fetch = mockFetch({ id: 1, username: 'alice', isAdmin: false });

    const result = await fetchMe();

    expect(fetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include' });
    expect(result.username).toBe('alice');
  });

  it('returns null when not authenticated', async () => {
    globalThis.fetch = mockFetch({}, false, 401);

    const result = await fetchMe();

    expect(result).toBeNull();
  });
});
