import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from './App.jsx';
import { usePhotos } from './context/PhotoContext.jsx';
import { useAuth } from './context/AuthContext.jsx';

vi.mock('./context/PhotoContext.jsx', () => ({
  PhotoProvider: ({ children }) => <div data-testid="provider">{children}</div>,
  usePhotos: vi.fn(),
}));

vi.mock('./context/AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(),
}));

vi.mock('./components/NavBar.jsx', () => ({
  default: () => <div data-testid="nav-bar" />,
}));

vi.mock('./components/FilterBar.jsx', () => ({
  default: ({ showTagFilters }) => (
    <div data-testid="filter-bar" data-show-tag-filters={String(showTagFilters)} />
  ),
}));

vi.mock('./components/PhotoGrid.jsx', () => ({
  default: ({ photos, draggable }) => (
    <div data-testid="photo-grid" data-count={photos.length} data-draggable={String(draggable)} />
  ),
}));

vi.mock('./components/TagGroup.jsx', () => ({
  default: ({ tag, photos }) => (
    <div data-testid={`tag-group-${tag}`} data-count={photos.length} />
  ),
}));

vi.mock('./components/UnratedSection.jsx', () => ({
  default: ({ photos }) => (
    <div data-testid="unrated-section" data-count={photos.length} />
  ),
}));

vi.mock('./components/PhotoModal.jsx', () => ({
  default: () => <div data-testid="photo-modal" />,
}));

vi.mock('./components/SubmitModal.jsx', () => ({
  default: () => <div data-testid="submit-modal" />,
}));

const mixedPhotos = [
  { id: 1, tag: 'love' },
  { id: 2, tag: 'love' },
  { id: 3, tag: 'like' },
  { id: 4, tag: 'meh' },
  { id: 5, tag: 'tax_deduction' },
  { id: 6, tag: 'unrated' },
  { id: 7, tag: 'unrated' },
];

const baseContext = {
  photos: mixedPhotos,
  scanPhotos: vi.fn(),
  loading: false,
  filterTag: 'all',
  viewMode: 'rank',
};

const adminUser = { id: 1, username: 'admin', isAdmin: true };
const regularUser = { id: 2, username: 'user', isAdmin: false };

beforeEach(() => {
  vi.restoreAllMocks();
  usePhotos.mockReturnValue({ ...baseContext });
  useAuth.mockReturnValue({ user: adminUser, logout: vi.fn() });
  cleanup();
});

describe('App layout', () => {
  it('renders all tag groups when filterTag is "all"', () => {
    render(<App />);

    expect(screen.getByTestId('tag-group-love')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('tag-group-like')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('tag-group-meh')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('tag-group-tax_deduction')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('unrated-section')).toHaveAttribute('data-count', '2');
  });

  it('renders single TagGroup when a specific tag filter is active', () => {
    usePhotos.mockReturnValue({ ...baseContext, filterTag: 'love' });
    render(<App />);

    expect(screen.getByTestId('tag-group-love')).toBeInTheDocument();
    expect(screen.queryByTestId('tag-group-like')).not.toBeInTheDocument();
    expect(screen.queryByTestId('unrated-section')).not.toBeInTheDocument();
  });

  it('renders UnratedSection when filterTag is "unrated"', () => {
    usePhotos.mockReturnValue({ ...baseContext, filterTag: 'unrated' });
    render(<App />);

    expect(screen.getByTestId('unrated-section')).toBeInTheDocument();
    expect(screen.queryByTestId('tag-group-love')).not.toBeInTheDocument();
  });

  it('shows loading message when loading with no photos', () => {
    usePhotos.mockReturnValue({ ...baseContext, photos: [], loading: true });
    render(<App />);

    expect(screen.getByText('Loading photos...')).toBeInTheDocument();
  });

  it('shows empty state when not loading with no photos', () => {
    usePhotos.mockReturnValue({ ...baseContext, photos: [], loading: false });
    render(<App />);

    expect(screen.getByText(/No photos found/)).toBeInTheDocument();
  });

  it('does not show loading or empty state when photos exist', () => {
    render(<App />);

    expect(screen.queryByText('Loading photos...')).not.toBeInTheDocument();
    expect(screen.queryByText(/No photos found/)).not.toBeInTheDocument();
  });

  it('passes all photos to TagGroup when filtering a specific tag', () => {
    usePhotos.mockReturnValue({ ...baseContext, filterTag: 'like' });
    render(<App />);

    // When filtered, TagGroup receives the full photos array (API already filters)
    expect(screen.getByTestId('tag-group-like')).toHaveAttribute('data-count', '7');
  });
});

describe('View mode: showId', () => {
  it('renders flat PhotoGrid with FilterBar (no tag filters) when viewMode is showId', () => {
    usePhotos.mockReturnValue({ ...baseContext, viewMode: 'showId' });
    render(<App />);

    expect(screen.getByTestId('photo-grid')).toBeInTheDocument();
    expect(screen.getByTestId('photo-grid')).toHaveAttribute('data-draggable', 'false');
    expect(screen.getByTestId('filter-bar')).toHaveAttribute('data-show-tag-filters', 'false');
    expect(screen.queryByTestId('tag-group-love')).not.toBeInTheDocument();
    expect(screen.queryByTestId('unrated-section')).not.toBeInTheDocument();
  });

  it('passes all photos to PhotoGrid in showId mode', () => {
    usePhotos.mockReturnValue({ ...baseContext, viewMode: 'showId' });
    render(<App />);

    expect(screen.getByTestId('photo-grid')).toHaveAttribute('data-count', '7');
  });

  it('renders NavBar in both view modes', () => {
    render(<App />);
    expect(screen.getByTestId('nav-bar')).toBeInTheDocument();

    cleanup();
    usePhotos.mockReturnValue({ ...baseContext, viewMode: 'showId' });
    render(<App />);
    expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
  });

  it('renders FilterBar with tag filters in rank mode', () => {
    render(<App />);
    expect(screen.getByTestId('filter-bar')).toHaveAttribute('data-show-tag-filters', 'true');
  });
});

describe('Admin vs regular user', () => {
  it('shows Scan Photos button for admin users', () => {
    render(<App />);

    expect(screen.getByText('Scan Photos')).toBeInTheDocument();
  });

  it('hides Scan Photos button for non-admin users', () => {
    useAuth.mockReturnValue({ user: regularUser, logout: vi.fn() });
    render(<App />);

    expect(screen.queryByText('Scan Photos')).not.toBeInTheDocument();
  });

  it('shows Submit to Show button for all users', () => {
    useAuth.mockReturnValue({ user: regularUser, logout: vi.fn() });
    render(<App />);

    expect(screen.getByText('Submit to Show')).toBeInTheDocument();
  });

  it('displays username and logout button', () => {
    render(<App />);

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Log Out')).toBeInTheDocument();
  });
});
