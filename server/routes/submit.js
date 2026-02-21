import { Router } from 'express';
import db from '../db.js';
import { tagPrioritySQL } from '../utils/tagPriority.js';

const router = Router();

const BASE_URL = 'https://patronsshow.theartleague.org';

function sendEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function extractCsrfToken(html) {
  // Prefer the hidden input token (what the form actually submits)
  const inputMatch = html.match(/<input\s+type="hidden"\s+name="_token"\s+value="([^"]+)"/);
  if (inputMatch) return inputMatch[1];
  // Fall back to meta tag
  const metaMatch = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
  return metaMatch ? metaMatch[1] : null;
}

function extractCookies(response, existing = '') {
  const setCookies = response.headers.getSetCookie?.() || [];
  const cookieMap = new Map();

  // Parse existing cookies
  if (existing) {
    for (const part of existing.split('; ')) {
      const [name, ...rest] = part.split('=');
      if (name) cookieMap.set(name.trim(), rest.join('='));
    }
  }

  // Merge new cookies
  for (const raw of setCookies) {
    const cookiePart = raw.split(';')[0];
    const [name, ...rest] = cookiePart.split('=');
    if (name) cookieMap.set(name.trim(), rest.join('='));
  }

  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Session state threaded through each step
function createSession() {
  return { cookies: '', token: null };
}

async function fetchLoginPage(session) {
  const res = await fetch(`${BASE_URL}/`);
  session.cookies = extractCookies(res, session.cookies);
  const html = await res.text();
  session.token = extractCsrfToken(html);

  if (!session.token) {
    throw new SubmitError('Could not extract CSRF token from login page');
  }
}

class SubmitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SubmitError';
  }
}

async function login(session, codename) {
  const body = new URLSearchParams({ '_token': session.token, 'code-name': codename });
  const loginRes = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': session.cookies,
    },
    body: body.toString(),
    redirect: 'manual',
  });
  session.cookies = extractCookies(loginRes, session.cookies);

  // Follow redirect manually to capture cookies
  const redirectUrl = loginRes.headers.get('location');
  if (redirectUrl) {
    const followRes = await fetch(
      redirectUrl.startsWith('http') ? redirectUrl : `${BASE_URL}${redirectUrl}`,
      { headers: { 'Cookie': session.cookies }, redirect: 'manual' }
    );
    session.cookies = extractCookies(followRes, session.cookies);
    const followHtml = await followRes.text();

    const newToken = extractCsrfToken(followHtml);
    if (newToken) session.token = newToken;

    if (redirectUrl.includes('/login') || followHtml.includes('name="code-name"')) {
      throw new SubmitError('Login failed. Check your codename and try again.');
    }
  } else {
    const body = await loginRes.text();
    if (body.includes('name="code-name"')) {
      throw new SubmitError('Login failed. Check your codename and try again.');
    }
    const newToken = extractCsrfToken(body);
    if (newToken) session.token = newToken;
  }
}

async function clearList(session) {
  const body = new URLSearchParams({ '_token': session.token });
  const res = await fetch(`${BASE_URL}/update-list`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': session.cookies,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  session.cookies = extractCookies(res, session.cookies);
}

function getSubmittablePhotos(userId) {
  return db.prepare(`
    SELECT p.id, p.filename, p.taken, p.show_id, p.artist, p.title,
           p.medium, p.dimensions, p.flickr_id, p.created_at,
           ur.tag, ur.group_position
    FROM photos p
    INNER JOIN user_ratings ur ON ur.photo_id = p.id AND ur.user_id = ?
    WHERE ur.tag IN ('love', 'like', 'meh')
    ORDER BY
      ${tagPrioritySQL('ur.tag')},
      ur.group_position
  `).all(userId);
}

async function addArtwork(session, showId) {
  const body = new URLSearchParams({ '_token': session.token, 'show-id': showId });
  const res = await fetch(`${BASE_URL}/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': session.cookies,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  session.cookies = extractCookies(res, session.cookies);

  const json = await res.json();
  return json.data?.artThiefId || null;
}

async function setOrder(session, artThiefIds) {
  const body = new URLSearchParams({ '_token': session.token });
  artThiefIds.forEach(id => body.append('artworks[]', id));
  const res = await fetch(`${BASE_URL}/update-list`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': session.cookies,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  session.cookies = extractCookies(res, session.cookies);
}

async function logout(session) {
  try {
    await fetch(`${BASE_URL}/logout`, {
      headers: { 'Cookie': session.cookies },
      redirect: 'manual',
    });
  } catch {
    // best-effort, ignore errors
  }
}

router.get('/', async (req, res) => {
  const { codename } = req.query;
  if (!codename) {
    res.status(400).json({ error: 'codename is required' });
    return;
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    // Step 1: Fetch login page for CSRF token + cookies
    sendEvent(res, { step: 'login', message: 'Fetching login page...' });
    const session = createSession();
    await fetchLoginPage(session);

    if (aborted) { res.end(); return; }

    // Step 2: POST login
    sendEvent(res, { step: 'login', message: `Logging in as "${codename}"...` });
    await login(session, codename);

    if (aborted) { res.end(); return; }

    // Step 3: Clear existing list
    sendEvent(res, { step: 'clear', message: 'Clearing existing list...' });
    await clearList(session);

    if (aborted) { res.end(); return; }

    // Step 4: Query local DB for submittable photos
    const photos = getSubmittablePhotos(req.session.userId);

    if (photos.length === 0) {
      sendEvent(res, { step: 'error', message: 'No photos tagged Love, Like, or Meh to submit.' });
      res.end();
      return;
    }

    sendEvent(res, { step: 'add', message: `Found ${photos.length} photos to submit`, current: 0, total: photos.length });

    // Step 5: Add artworks one by one
    const artThiefIds = [];
    for (let i = 0; i < photos.length; i++) {
      if (aborted) { res.end(); return; }

      const photo = photos[i];
      const showId = photo.show_id;
      if (!showId) {
        sendEvent(res, { step: 'add', message: `Skipping "${photo.filename}" (no show ID)`, current: i + 1, total: photos.length });
        continue;
      }

      sendEvent(res, { step: 'add', message: `Adding #${showId} (${i + 1}/${photos.length})...`, current: i + 1, total: photos.length });

      const artThiefId = await addArtwork(session, showId);
      if (artThiefId) artThiefIds.push(artThiefId);

      // Small delay to be polite to the server
      if (i < photos.length - 1) {
        await sleep(300);
      }
    }

    if (aborted) { res.end(); return; }

    // Step 6: Set final order
    sendEvent(res, { step: 'order', message: 'Setting final ranked order...' });
    await setOrder(session, artThiefIds);

    if (aborted) { res.end(); return; }

    // Step 7: Logout (best-effort)
    sendEvent(res, { step: 'logout', message: 'Logging out...' });
    await logout(session);

    // Step 8: Done
    sendEvent(res, { step: 'done', message: `Successfully submitted ${artThiefIds.length} artworks!` });
    res.end();
  } catch (err) {
    console.error('Submit error:', err);
    if (!res.writableEnded) {
      sendEvent(res, { step: 'error', message: `Submission failed: ${err.message}` });
      res.end();
    }
  }
});

export default router;
export { extractCsrfToken, extractCookies, createSession, getSubmittablePhotos, SubmitError };
