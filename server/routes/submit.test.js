import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import db from '../db.js';
import submitRouter from './submit.js';

const app = express();
app.use(express.json());
app.use('/api/submit', submitRouter);

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
      `INSERT INTO photos (filename, tag, group_position, taken, show_id, artist, title, medium, dimensions, flickr_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.filename,
      data.tag,
      data.group_position,
      data.taken,
      data.show_id,
      data.artist,
      data.title,
      data.medium,
      data.dimensions,
      data.flickr_id,
    );
  return result.lastInsertRowid;
}

function clearPhotos() {
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
    // GET / — login page
    loginPage: {
      ok: true,
      text: async () => loginPageHtml,
      headers: new Headers(),
    },
    // POST /login — redirect to dashboard
    login: {
      ok: true,
      status: 302,
      text: async () => '',
      headers: new Headers({ location: '/dashboard' }),
    },
    // GET /dashboard — follow redirect
    dashboard: {
      ok: true,
      text: async () => dashboardHtml,
      headers: new Headers(),
    },
    // PUT /update-list — clear/order
    updateList: {
      ok: true,
      text: async () => '{}',
      json: async () => ({}),
      headers: new Headers(),
    },
    // POST /add — add artwork
    add: {
      ok: true,
      json: async () => ({ data: { artThiefId: 42 } }),
      headers: new Headers(),
    },
    // GET /logout
    logout: {
      ok: true,
      text: async () => '',
      headers: new Headers(),
    },
  };

  const responses = { ...defaults, ...overrides };

  // Attach getSetCookie to all headers
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

describe('GET /api/submit', () => {
  let originalFetch;

  beforeEach(() => {
    clearPhotos();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearPhotos();
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

    // Verify the expected sequence of steps
    assert.ok(steps.includes('login'));
    assert.ok(steps.includes('clear'));
    assert.ok(steps.includes('add'));
    assert.ok(steps.includes('order'));
    assert.ok(steps.includes('logout'));
    assert.ok(steps.includes('done'));

    // Verify done message includes count
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

    // Wrap to capture show IDs from add calls
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

    // Should only submit love, like, meh (not tax_deduction or unrated)
    assert.equal(addedShowIds.length, 3);
    // Order: love first (10), then like (20), then meh (30)
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
          const h = new Headers(); // no location header
          h.getSetCookie = () => [];
          return h;
        })(),
      },
    });

    // No photos, so it'll error after login succeeds — that confirms login path worked
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
    // Should get past login to the clear step before erroring on no photos
    assert.ok(steps.includes('clear'));
    const errorEvent = events.find((e) => e.step === 'error');
    assert.match(errorEvent.message, /No photos tagged/);
  });
});
