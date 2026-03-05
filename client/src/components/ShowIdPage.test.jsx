import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ShowIdPage from './ShowIdPage.jsx';
import { usePhotos } from '../context/PhotoContext.jsx';

vi.mock('../context/PhotoContext.jsx', () => ({
  usePhotos: vi.fn(),
}));

vi.mock('./FilterBar.jsx', () => ({
  default: ({ showTagFilters }) => (
    <div data-testid="filter-bar" data-show-tag-filters={String(showTagFilters)} />
  ),
}));

vi.mock('./PhotoGrid.jsx', () => ({
  default: ({ photos, draggable, showRank }) => (
    <div
      data-testid="photo-grid"
      data-count={photos.length}
      data-draggable={String(draggable)}
      data-show-rank={String(showRank)}
    />
  ),
}));

const photos = [
  { id: 1, show_id: '5' },
  { id: 2, show_id: '12' },
  { id: 3, show_id: '30' },
];

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('ShowIdPage', () => {
  it('renders FilterBar without tag filters', () => {
    usePhotos.mockReturnValue({ photos });
    render(<ShowIdPage />);

    expect(screen.getByTestId('filter-bar')).toHaveAttribute('data-show-tag-filters', 'false');
  });

  it('renders PhotoGrid with all photos, no drag, no rank', () => {
    usePhotos.mockReturnValue({ photos });
    render(<ShowIdPage />);

    const grid = screen.getByTestId('photo-grid');
    expect(grid).toHaveAttribute('data-count', '3');
    expect(grid).toHaveAttribute('data-draggable', 'false');
    expect(grid).toHaveAttribute('data-show-rank', 'false');
  });
});
