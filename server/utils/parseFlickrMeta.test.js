import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlickrMeta } from './parseFlickrMeta.js';

describe('parseFlickrMeta', () => {
  it('parses standard 5-part title', () => {
    const result = parseFlickrMeta('42 | Jane Doe | Sunset | Oil | 10x12');
    assert.deepEqual(result, {
      show_id: '042',
      artist: 'Jane Doe',
      title: 'Sunset',
      medium: 'Oil',
      dimensions: '10x12',
    });
  });

  it('pads show_id to 3 digits', () => {
    assert.equal(parseFlickrMeta('1 | A | B | C | D').show_id, '001');
    assert.equal(parseFlickrMeta('42 | A | B | C | D').show_id, '042');
    assert.equal(parseFlickrMeta('123 | A | B | C | D').show_id, '123');
  });

  it('joins multi-segment medium with commas', () => {
    const result = parseFlickrMeta('1 | Artist | Title | Oil | Collage | 10x12');
    assert.equal(result.medium, 'Oil, Collage');
  });

  it('returns nulls for null input', () => {
    assert.deepEqual(parseFlickrMeta(null), {
      show_id: null,
      artist: null,
      title: null,
      medium: null,
      dimensions: null,
    });
  });

  it('returns nulls for undefined input', () => {
    assert.deepEqual(parseFlickrMeta(undefined), {
      show_id: null,
      artist: null,
      title: null,
      medium: null,
      dimensions: null,
    });
  });

  it('returns nulls for empty string', () => {
    assert.deepEqual(parseFlickrMeta(''), {
      show_id: null,
      artist: null,
      title: null,
      medium: null,
      dimensions: null,
    });
  });

  it('returns raw title when fewer than 5 parts', () => {
    const result = parseFlickrMeta('Some random title');
    assert.deepEqual(result, {
      show_id: null,
      artist: null,
      title: 'Some random title',
      medium: null,
      dimensions: null,
    });
  });

  it('trims whitespace around pipe separators', () => {
    const result = parseFlickrMeta('  7  |  Jane  |  Sunset  |  Oil  |  10x12  ');
    assert.equal(result.show_id, '007');
    assert.equal(result.artist, 'Jane');
    assert.equal(result.title, 'Sunset');
    assert.equal(result.medium, 'Oil');
    assert.equal(result.dimensions, '10x12');
  });
});
