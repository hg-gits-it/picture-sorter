import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import RankPage from './RankPage.jsx';
import { usePhotos } from '../context/PhotoContext.jsx';

vi.mock('../context/PhotoContext.jsx', () => ({
  usePhotos: vi.fn(),
}));

vi.mock('./FilterBar.jsx', () => ({
  default: ({ showTagFilters }) => (
    <div data-testid="filter-bar" data-show-tag-filters={String(showTagFilters ?? true)} />
  ),
}));

vi.mock('./TagGroup.jsx', () => ({
  default: ({ tag, photos }) => (
    <div data-testid={`tag-group-${tag}`} data-count={photos.length} />
  ),
}));

vi.mock('./UnratedSection.jsx', () => ({
  default: ({ photos }) => (
    <div data-testid="unrated-section" data-count={photos.length} />
  ),
}));

const mixedPhotos = [
  { id: 1, tag: 'love' },
  { id: 2, tag: 'love' },
  { id: 3, tag: 'like' },
  { id: 4, tag: 'meh' },
  { id: 5, tag: 'pass' },
  { id: 6, tag: 'unrated' },
  { id: 7, tag: 'unrated' },
];

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('RankPage', () => {
  it('renders FilterBar with tag filters', () => {
    usePhotos.mockReturnValue({ photos: mixedPhotos, filterTag: 'all' });
    render(<RankPage />);

    expect(screen.getByTestId('filter-bar')).toHaveAttribute('data-show-tag-filters', 'true');
  });

  it('renders all tag groups when filterTag is "all"', () => {
    usePhotos.mockReturnValue({ photos: mixedPhotos, filterTag: 'all' });
    render(<RankPage />);

    expect(screen.getByTestId('tag-group-love')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('tag-group-like')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('tag-group-meh')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('tag-group-pass')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('unrated-section')).toHaveAttribute('data-count', '2');
  });

  it('renders single TagGroup when a specific tag filter is active', () => {
    usePhotos.mockReturnValue({ photos: mixedPhotos, filterTag: 'love' });
    render(<RankPage />);

    expect(screen.getByTestId('tag-group-love')).toBeInTheDocument();
    expect(screen.queryByTestId('tag-group-like')).not.toBeInTheDocument();
    expect(screen.queryByTestId('unrated-section')).not.toBeInTheDocument();
  });

  it('renders UnratedSection when filterTag is "unrated"', () => {
    usePhotos.mockReturnValue({ photos: mixedPhotos, filterTag: 'unrated' });
    render(<RankPage />);

    expect(screen.getByTestId('unrated-section')).toBeInTheDocument();
    expect(screen.queryByTestId('tag-group-love')).not.toBeInTheDocument();
  });

  it('passes all photos to TagGroup when filtering a specific tag', () => {
    usePhotos.mockReturnValue({ photos: mixedPhotos, filterTag: 'like' });
    render(<RankPage />);

    expect(screen.getByTestId('tag-group-like')).toHaveAttribute('data-count', '7');
  });
});
