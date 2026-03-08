import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import { PhotoProvider, usePhotos } from './PhotoContext.jsx';
import * as api from '../api/photos.js';

vi.mock('../api/photos.js', () => ({
  fetchPhotos: vi.fn(),
  tagPhoto: vi.fn(),
  reorderPhoto: vi.fn(),
  triggerScan: vi.fn(),
}));

const defaultResponse = {
  photos: [{ id: 1, filename: 'test.jpg', tag: null }],
  counts: { total: 1, love: 0, like: 0, meh: 0, pass: 0, unrated: 1 },
};

function TestConsumer({ onContext }) {
  const ctx = usePhotos();
  React.useEffect(() => {
    onContext(ctx);
  });
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="count">{ctx.photos.length}</span>
      <span data-testid="filterTag">{ctx.filterTag}</span>
      <span data-testid="searchQuery">{ctx.searchQuery}</span>
      <span data-testid="hideClaimed">{String(ctx.hideClaimed)}</span>
      <span data-testid="viewMode">{ctx.viewMode}</span>
      <span data-testid="selectedPhoto">{ctx.selectedPhoto ? ctx.selectedPhoto.id : 'null'}</span>
    </div>
  );
}

function renderWithProvider() {
  const ref = { current: null };
  const onContext = (ctx) => { ref.current = ctx; };
  const result = render(
    <PhotoProvider>
      <TestConsumer onContext={onContext} />
    </PhotoProvider>,
  );
  return { ...result, ctx: ref };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.restoreAllMocks();
  api.fetchPhotos.mockResolvedValue(defaultResponse);
  api.tagPhoto.mockResolvedValue({});
  api.reorderPhoto.mockResolvedValue({});
  api.triggerScan.mockResolvedValue({});
});

describe('PhotoProvider', () => {
  it('loads photos on mount with default hideClaimed=true', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalledWith({ hideClaimed: true });
    });

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
    });
  });

  it('reloads with tag param when setFilterTag is called', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    api.fetchPhotos.mockResolvedValue({
      photos: [{ id: 2 }],
      counts: { total: 1, love: 1, like: 0, meh: 0, pass: 0, unrated: 0 },
    });

    await act(() => {
      ctx.current.setFilterTag('love');
    });

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalledWith({ tag: 'love', hideClaimed: true });
    });
  });

  it('debounces search query and reloads', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    api.fetchPhotos.mockClear();

    await act(() => {
      ctx.current.setSearchQuery('sunset');
    });

    // Should eventually call after debounce (300ms)
    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalledWith({
        search: 'sunset',
        hideClaimed: true,
      });
    });
  });

  it('reloads when setHideClaimed is toggled', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    api.fetchPhotos.mockClear();

    await act(() => {
      ctx.current.setHideClaimed(false);
    });

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalledWith({});
    });
  });

  it('tagPhoto calls api.tagPhoto then reloads in rank mode', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    api.fetchPhotos.mockClear();

    await act(async () => {
      await ctx.current.tagPhoto(1, 'love');
    });

    expect(api.tagPhoto).toHaveBeenCalledWith(1, 'love');
    expect(api.fetchPhotos).toHaveBeenCalled();
  });

  it('tagPhoto updates tag locally without re-fetching in showId mode', async () => {
    api.fetchPhotos.mockResolvedValue({
      photos: [
        { id: 1, filename: 'a.jpg', tag: 'unrated' },
        { id: 2, filename: 'b.jpg', tag: 'unrated' },
      ],
      counts: { total: 0, love: 0, like: 0, meh: 0, pass: 0, unrated: 0 },
    });

    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    // Switch to showId mode
    await act(() => {
      ctx.current.setViewMode('showId');
    });

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalledWith({ sort: 'show_id', hideClaimed: true });
    });

    api.fetchPhotos.mockClear();

    await act(async () => {
      await ctx.current.tagPhoto(1, 'love');
    });

    expect(api.tagPhoto).toHaveBeenCalledWith(1, 'love');
    // Should NOT re-fetch in showId mode
    expect(api.fetchPhotos).not.toHaveBeenCalled();
  });

  it('reorderPhoto calls api.reorderPhoto then reloads', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    api.fetchPhotos.mockClear();

    await act(async () => {
      await ctx.current.reorderPhoto(1, 3);
    });

    expect(api.reorderPhoto).toHaveBeenCalledWith(1, 3);
    expect(api.fetchPhotos).toHaveBeenCalled();
  });

  it('scanPhotos calls api.triggerScan then reloads', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    api.fetchPhotos.mockClear();

    await act(async () => {
      await ctx.current.scanPhotos();
    });

    expect(api.triggerScan).toHaveBeenCalled();
    expect(api.fetchPhotos).toHaveBeenCalled();
  });

  it('defaults viewMode to rank', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('viewMode').textContent).toBe('rank');
    });
  });

  it('reloads with sort=show_id when setViewMode is called with showId', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    api.fetchPhotos.mockClear();

    await act(() => {
      ctx.current.setViewMode('showId');
    });

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalledWith({ sort: 'show_id', hideClaimed: true });
    });
  });

  it('omits tag param but includes search in showId mode', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalled();
    });

    // Set filter and search first
    await act(() => {
      ctx.current.setFilterTag('love');
    });

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalledWith({ tag: 'love', hideClaimed: true });
    });

    api.fetchPhotos.mockClear();

    // Switch to showId mode — should not include tag or search
    await act(() => {
      ctx.current.setViewMode('showId');
    });

    await waitFor(() => {
      expect(api.fetchPhotos).toHaveBeenCalledWith({ sort: 'show_id', hideClaimed: true });
    });
  });

  it('setSelectedPhoto updates selectedPhoto state', async () => {
    const { ctx } = renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('selectedPhoto').textContent).toBe('null');
    });

    await act(() => {
      ctx.current.setSelectedPhoto({ id: 5 });
    });

    expect(screen.getByTestId('selectedPhoto').textContent).toBe('5');
  });
});

describe('usePhotos', () => {
  it('throws when used outside PhotoProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer onContext={() => {}} />);
    }).toThrow('usePhotos must be used within PhotoProvider');

    spy.mockRestore();
  });
});
