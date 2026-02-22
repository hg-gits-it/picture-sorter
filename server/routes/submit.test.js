import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import db from '../db.js';
import submitRouter, { extractCsrfToken, extractCookies, createSession, getSubmittablePhotos } from './submit.js';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = { userId: 1, isAdmin: true };
  next();
});
app.use('/api/submit', submitRouter);

function insertUser() {
  db.prepare(
    'INSERT OR IGNORE INTO users (id, username, password_hash, is_admin) VALUES (1, \'admin\', \'hash\', 1)',
  ).run();
}

function insertPhoto(overrides = {}) {
  const defaults = {
    filename: '001--artist--title--oil--10x10_flickrid_o.jpg',
    tag: 'unrated',
    group_position: null,
    taken: 0,
    show_id: null,
    artist: null,
    title: null,
    medium: null,
    dimensions: null,
    flickr_id: null,
  };
  const data = { ...defaults, ...overrides };
  const result = db
    .prepare(
      `INSERT INTO photos (filename, taken, show_id, artist, title, medium, dimensions, flickr_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.filename,
      data.taken,
      data.show_id,
      data.artist,
      data.title,
      data.medium,
      data.dimensions,
      data.flickr_id,
    );

  const photoId = result.lastInsertRowid;

  if (data.tag !== 'unrated') {
    db.prepare(
      'INSERT INTO user_ratings (user_id, photo_id, tag, group_position) VALUES (1, ?, ?, ?)',
    ).run(photoId, data.tag, data.group_position);
  }

  return photoId;
}

function clearData() {
  db.prepare('DELETE FROM user_ratings').run();
  db.prepare('DELETE FROM photos').run();
}

// Parse SSE text into array of data objects
function parseSSE(text) {
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.replace('data: ', '')));
}

// Build a mock fetch that responds based on URL
function createMockFetch(overrides = {}) {
  const loginPageHtml = `
    <html>
      <input type="hidden" name="_token" value="csrf-token-123">
      <form></form>
    </html>
  `;

  const dashboardHtml = `
    <html>
      <meta name="csrf-token" content="csrf-token-456">
      <h1>Dashboard</h1>
    </html>
  `;

  const defaults = {
    loginPage: {
      ok: true,
      text: async () => loginPageHtml,
      headers: new Headers(),
    },
    login: {
      ok: true,
      status: 302,
      text: async () => '',
      headers: new Headers({ location: '/dashboard' }),
    },
    dashboard: {
      ok: true,
      text: async () => dashboardHtml,
      headers: new Headers(),
    },
    updateList: {
      ok: true,
      text: async () => '{}',
      json: async () => ({}),
      headers: new Headers(),
    },
    add: {
      ok: true,
      json: async () => ({ data: { artThiefId: 42 } }),
      headers: new Headers(),
    },
    logout: {
      ok: true,
      text: async () => '',
      headers: new Headers(),
    },
  };

  const responses = { ...defaults, ...overrides };

  for (const resp of Object.values(responses)) {
    if (resp.headers && !resp.headers.getSetCookie) {
      resp.headers.getSetCookie = () => [];
    }
  }

  return async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'GET' && url.endsWith('/')) return responses.loginPage;
    if (method === 'POST' && url.includes('/login')) return responses.login;
    if (method === 'GET' && url.includes('/dashboard'))
      return responses.dashboard;
    if (method === 'PUT' && url.includes('/update-list'))
      return responses.updateList;
    if (method === 'POST' && url.includes('/add')) return responses.add;
    if (method === 'GET' && url.includes('/logout')) return responses.logout;
    return { ok: true, text: async () => '', headers: new Headers() };
  };
}


describe('extractCsrfToken', () => {
  it('extracts token from hidden input', () => {
    const html = '<input type="hidden" name="_token" value="abc123">';
    assert.equal(extractCsrfToken(html), 'abc123');
  });

  it('falls back to meta tag', () => {
    const html = '<meta name="csrf-token" content="meta456">';
    assert.equal(extractCsrfToken(html), 'meta456');
  });

  it('prefers hidden input over meta tag', () => {
    const html = `
      <meta name="csrf-token" content="meta-token">
      <input type="hidden" name="_token" value="input-token">
    `;
    assert.equal(extractCsrfToken(html), 'input-token');
  });

  it('returns null when no token found', () => {
    assert.equal(extractCsrfToken('<html>no token</html>'), null);
  });
});

describe('extractCookies', () => {
  it('parses set-cookie headers into cookie string', () => {
    const response = {
      headers: { getSetCookie: () => ['session=abc; Path=/; HttpOnly', 'theme=dark; Path=/'] },
    };
    const result = extractCookies(response);
    assert.equal(result, 'session=abc; theme=dark');
  });

  it('merges with existing cookies', () => {
    const response = {
      headers: { getSetCookie: () => ['new=val'] },
    };
    const result = extractCookies(response, 'existing=old');
    assert.ok(result.includes('existing=old'));
    assert.ok(result.includes('new=val'));
  });

  it('overwrites existing cookies with same name', () => {
    const response = {
      headers: { getSetCookie: () => ['session=updated'] },
    };
    const result = extractCookies(response, 'session=old; other=keep');
    assert.ok(result.includes('session=updated'));
    assert.ok(result.includes('other=keep'));
    assert.ok(!result.includes('session=old'));
  });

  it('returns empty string when no cookies', () => {
    const response = { headers: { getSetCookie: () => [] } };
    assert.equal(extractCookies(response), '');
  });

  it('handles missing getSetCookie gracefully', () => {
    const response = { headers: {} };
    assert.equal(extractCookies(response), '');
  });
});

describe('createSession', () => {
  it('returns an object with empty cookies and null token', () => {
    const session = createSession();
    assert.equal(session.cookies, '');
    assert.equal(session.token, null);
  });
});

describe('getSubmittablePhotos', () => {
  beforeEach(() => {
    clearData();
    insertUser();
  });
  afterEach(clearData);

  it('returns love, like, and meh photos in priority order', () => {
    insertPhoto({ filename: 'meh.jpg', tag: 'meh', group_position: 1, show_id: '3' });
    insertPhoto({ filename: 'love.jpg', tag: 'love', group_position: 1, show_id: '1' });
    insertPhoto({ filename: 'like.jpg', tag: 'like', group_position: 1, show_id: '2' });

    const photos = getSubmittablePhotos(1);
    assert.equal(photos.length, 3);
    assert.equal(photos[0].tag, 'love');
    assert.equal(photos[1].tag, 'like');
    assert.equal(photos[2].tag, 'meh');
  });

  it('excludes tax_deduction and unrated photos', () => {
    insertPhoto({ filename: 'love.jpg', tag: 'love', group_position: 1, show_id: '1' });
    insertPhoto({ filename: 'tax.jpg', tag: 'tax_deduction', group_position: 1, show_id: '2' });
    insertPhoto({ filename: 'unrated.jpg', show_id: '3' });

    const photos = getSubmittablePhotos(1);
    assert.equal(photos.length, 1);
    assert.equal(photos[0].tag, 'love');
  });

  it('orders by group_position within same tag', () => {
    insertPhoto({ filename: 'a.jpg', tag: 'love', group_position: 2, show_id: '1' });
    insertPhoto({ filename: 'b.jpg', tag: 'love', group_position: 1, show_id: '2' });

    const photos = getSubmittablePhotos(1);
    assert.equal(photos[0].group_position, 1);
    assert.equal(photos[1].group_position, 2);
  });

  it('returns empty array when no matching photos', () => {
    insertPhoto({ filename: 'unrated.jpg', show_id: '1' });
    assert.equal(getSubmittablePhotos(1).length, 0);
  });
});

describe('GET /api/submit', () => {
  let originalFetch;

  beforeEach(() => {
    clearData();
    insertUser();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearData();
  });

  it('returns 400 when codename is missing', async () => {
    const res = await request(app).get('/api/submit').expect(400);

    assert.deepEqual(res.body, { error: 'codename is required' });
  });

  it('streams error when CSRF token extraction fails', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => '<html>no token here</html>',
      headers: { getSetCookie: () => [] },
    });

    const res = await request(app)
      .get('/api/submit?codename=test')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => cb(null, data));
      });

    const events = parseSSE(res.body);
    const errorEvent = events.find((e) => e.step === 'error');
    assert.ok(errorEvent);
    assert.match(errorEvent.message, /CSRF token/);
  });

  it('streams error when login fails (redirect to login page)', async () => {
    const loginPageHtml =
      '<input type="hidden" name="_token" value="tok"><form name="code-name"></form>';
    globalThis.fetch = createMockFetch({
      login: {
        ok: true,
        status: 302,
        text: async () => '',
        headers: (() => {
          const h = new Headers({ location: '/login' });
          h.getSetCookie = () => [];
          return h;
        })(),
      },
      dashboard: {
        ok: true,
        text: async () => loginPageHtml,
        headers: (() => {
          const h = new Headers();
          h.getSetCookie = () => [];
          return h;
        })(),
      },
    });

    const res = await request(app)
      .get('/api/submit?codename=badcode')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => cb(null, data));
      });

    const events = parseSSE(res.body);
    const errorEvent = events.find((e) => e.step === 'error');
    assert.ok(errorEvent);
    assert.match(errorEvent.message, /Login failed/);
  });

  it('streams error when no photos to submit', async () => {
    globalThis.fetch = createMockFetch();

    const res = await request(app)
      .get('/api/submit?codename=testuser')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => cb(null, data));
      });

    const events = parseSSE(res.body);
    const errorEvent = events.find((e) => e.step === 'error');
    assert.ok(errorEvent);
    assert.match(errorEvent.message, /No photos tagged/);
  });

  it('submits photos and streams progress events', async () => {
    insertPhoto({
      filename: '010--artist--title--oil--10x10_abc_o.jpg',
      tag: 'love',
      group_position: 1,
      show_id: '010',
    });
    insertPhoto({
      filename: '020--artist--title--acrylic--10x10_def_o.jpg',
      tag: 'like',
      group_position: 1,
      show_id: '020',
    });

    let addCallCount = 0;
    globalThis.fetch = createMockFetch({
      add: {
        ok: true,
        json: async () => {
          addCallCount++;
          return { data: { artThiefId: 100 + addCallCount } };
        },
        headers: (() => {
          const h = new Headers();
          h.getSetCookie = () => [];
          return h;
        })(),
      },
    });

    const res = await request(app)
      .get('/api/submit?codename=testuser')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => cb(null, data));
      });

    const events = parseSSE(res.body);
    const steps = events.map((e) => e.step);

    assert.ok(steps.includes('login'));
    assert.ok(steps.includes('clear'));
    assert.ok(steps.includes('add'));
    assert.ok(steps.includes('order'));
    assert.ok(steps.includes('logout'));
    assert.ok(steps.includes('done'));

    const doneEvent = events.find((e) => e.step === 'done');
    assert.match(doneEvent.message, /2 artworks/);
  });

  it('skips photos without show ID', async () => {
    insertPhoto({
      filename: '010--artist--title--oil--10x10_abc_o.jpg',
      tag: 'love',
      group_position: 1,
      show_id: '010',
    });
    insertPhoto({
      filename: 'no-show-id.jpg',
      tag: 'love',
      group_position: 2,
    });

    globalThis.fetch = createMockFetch();

    const res = await request(app)
      .get('/api/submit?codename=testuser')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => cb(null, data));
      });

    const events = parseSSE(res.body);
    const skipEvent = events.find(
      (e) => e.step === 'add' && e.message?.includes('Skipping'),
    );
    assert.ok(skipEvent);
    assert.match(skipEvent.message, /no-show-id\.jpg/);

    const doneEvent = events.find((e) => e.step === 'done');
    assert.match(doneEvent.message, /1 artworks/);
  });

  it('only submits love, like, and meh photos in priority order', async () => {
    insertPhoto({
      filename: '030--a--t--oil--1x1_c_o.jpg',
      tag: 'meh',
      group_position: 1,
      show_id: '030',
    });
    insertPhoto({
      filename: '010--a--t--oil--1x1_a_o.jpg',
      tag: 'love',
      group_position: 1,
      show_id: '010',
    });
    insertPhoto({
      filename: '020--a--t--oil--1x1_b_o.jpg',
      tag: 'like',
      group_position: 1,
      show_id: '020',
    });
    insertPhoto({
      filename: '040--a--t--oil--1x1_d_o.jpg',
      tag: 'tax_deduction',
      group_position: 1,
      show_id: '040',
    });
    insertPhoto({ filename: '050--a--t--oil--1x1_e_o.jpg', show_id: '050' }); // unrated

    const addedShowIds = [];
    globalThis.fetch = createMockFetch({
      add: {
        ok: true,
        json: async () => ({ data: { artThiefId: 1 } }),
        headers: (() => {
          const h = new Headers();
          h.getSetCookie = () => [];
          return h;
        })(),
      },
    });

    const baseFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
      if (opts.method === 'POST' && url.includes('/add')) {
        const body = new URLSearchParams(opts.body);
        addedShowIds.push(body.get('show-id'));
      }
      return baseFetch(url, opts);
    };

    await request(app)
      .get('/api/submit?codename=testuser')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => cb(null, data));
      });

    assert.equal(addedShowIds.length, 3);
    assert.deepEqual(addedShowIds, ['010', '020', '030']);
  });

  it('streams error when external fetch throws', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network failure');
    };

    const res = await request(app)
      .get('/api/submit?codename=testuser')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => cb(null, data));
      });

    const events = parseSSE(res.body);
    const errorEvent = events.find((e) => e.step === 'error');
    assert.ok(errorEvent);
    assert.match(errorEvent.message, /Network failure/);
  });

  it('handles login with no redirect', async () => {
    const dashboardHtml =
      '<html><meta name="csrf-token" content="new-tok"><h1>Dashboard</h1></html>';
    globalThis.fetch = createMockFetch({
      login: {
        ok: true,
        status: 200,
        text: async () => dashboardHtml,
        headers: (() => {
          const h = new Headers();
          h.getSetCookie = () => [];
          return h;
        })(),
      },
    });

    const res = await request(app)
      .get('/api/submit?codename=testuser')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => cb(null, data));
      });

    const events = parseSSE(res.body);
    const steps = events.map((e) => e.step);
    assert.ok(steps.includes('clear'));
    const errorEvent = events.find((e) => e.step === 'error');
    assert.match(errorEvent.message, /No photos tagged/);
  });
});
