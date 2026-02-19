import { Router } from 'express';
import db from '../db.js';

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

    let cookies = '';
    const loginPageRes = await fetch(`${BASE_URL}/`);
    cookies = extractCookies(loginPageRes, cookies);
    const loginHtml = await loginPageRes.text();
    let token = extractCsrfToken(loginHtml);

    if (!token) {
      sendEvent(res, { step: 'error', message: 'Could not extract CSRF token from login page' });
      res.end();
      return;
    }

    if (aborted) { res.end(); return; }

    // Step 2: POST login
    sendEvent(res, { step: 'login', message: `Logging in as "${codename}"...` });

    const loginBody = new URLSearchParams({ '_token': token, 'code-name': codename });
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: loginBody.toString(),
      redirect: 'manual',
    });
    cookies = extractCookies(loginRes, cookies);

    // Follow redirect manually to capture cookies
    const redirectUrl = loginRes.headers.get('location');
    if (redirectUrl) {
      const followRes = await fetch(
        redirectUrl.startsWith('http') ? redirectUrl : `${BASE_URL}${redirectUrl}`,
        { headers: { 'Cookie': cookies }, redirect: 'manual' }
      );
      cookies = extractCookies(followRes, cookies);
      const followHtml = await followRes.text();

      // Update CSRF token from redirected page
      const newToken = extractCsrfToken(followHtml);
      if (newToken) token = newToken;

      // Detect login failure: if we got redirected back to /login
      if (redirectUrl.includes('/login') || followHtml.includes('name="code-name"')) {
        sendEvent(res, { step: 'error', message: 'Login failed. Check your codename and try again.' });
        res.end();
        return;
      }
    } else {
      // No redirect — check if response itself is still the login page
      const body = await loginRes.text();
      if (body.includes('name="code-name"')) {
        sendEvent(res, { step: 'error', message: 'Login failed. Check your codename and try again.' });
        res.end();
        return;
      }
      const newToken = extractCsrfToken(body);
      if (newToken) token = newToken;
    }

    if (aborted) { res.end(); return; }

    // Step 3: Clear existing list
    sendEvent(res, { step: 'clear', message: 'Clearing existing list...' });

    const clearBody = new URLSearchParams({ '_token': token });
    const clearRes = await fetch(`${BASE_URL}/update-list`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: clearBody.toString(),
    });
    cookies = extractCookies(clearRes, cookies);

    if (aborted) { res.end(); return; }

    // Step 4: Query local DB for submittable photos
    const photos = db.prepare(`
      SELECT * FROM photos
      WHERE tag IN ('love', 'like', 'meh')
      ORDER BY
        CASE tag
          WHEN 'love' THEN 1
          WHEN 'like' THEN 2
          WHEN 'meh' THEN 3
        END,
        group_position
    `).all();

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
      // Extract show-id from filename prefix (number before first --)
      const showIdMatch = photo.filename.match(/^(\d+)--/);
      if (!showIdMatch) {
        sendEvent(res, { step: 'add', message: `Skipping "${photo.filename}" (no show ID)`, current: i + 1, total: photos.length });
        continue;
      }
      const showId = String(parseInt(showIdMatch[1], 10));

      sendEvent(res, { step: 'add', message: `Adding #${showId} (${i + 1}/${photos.length})...`, current: i + 1, total: photos.length });

      const addBody = new URLSearchParams({ '_token': token, 'show-id': showId });
      const addRes = await fetch(`${BASE_URL}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: addBody.toString(),
      });
      cookies = extractCookies(addRes, cookies);

      const addJson = await addRes.json();
      if (addJson.data?.artThiefId) {
        artThiefIds.push(addJson.data.artThiefId);
      }

      // Small delay to be polite to the server
      if (i < photos.length - 1) {
        await sleep(300);
      }
    }

    if (aborted) { res.end(); return; }

    // Step 6: Set final order
    sendEvent(res, { step: 'order', message: 'Setting final ranked order...' });

    const orderBody = new URLSearchParams({ '_token': token });
    artThiefIds.forEach(id => orderBody.append('artworks[]', id));
    const orderRes = await fetch(`${BASE_URL}/update-list`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: orderBody.toString(),
    });
    cookies = extractCookies(orderRes, cookies);

    if (aborted) { res.end(); return; }

    // Step 7: Logout (best-effort)
    sendEvent(res, { step: 'logout', message: 'Logging out...' });
    try {
      await fetch(`${BASE_URL}/logout`, {
        headers: { 'Cookie': cookies },
        redirect: 'manual',
      });
    } catch {
      // best-effort, ignore errors
    }

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
