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

vi.mock('./components/RankPage.jsx', () => ({
  default: () => <div data-testid="rank-page" />,
}));

vi.mock('./components/ShowIdPage.jsx', () => ({
  default: () => <div data-testid="showid-page" />,
}));

vi.mock('./components/UserMenu.jsx', () => ({
  default: () => <div data-testid="user-menu" />,
}));

vi.mock('./components/PhotoModal.jsx', () => ({
  default: () => <div data-testid="photo-modal" />,
}));

vi.mock('./components/SubmitModal.jsx', () => ({
  default: () => <div data-testid="submit-modal" />,
}));

const baseContext = {
  photos: [{ id: 1 }],
  scanPhotos: vi.fn(),
  loading: false,
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
  it('renders NavBar and UserMenu', () => {
    render(<App />);

    expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('renders RankPage when viewMode is rank', () => {
    render(<App />);

    expect(screen.getByTestId('rank-page')).toBeInTheDocument();
    expect(screen.queryByTestId('showid-page')).not.toBeInTheDocument();
  });

  it('renders ShowIdPage when viewMode is showId', () => {
    usePhotos.mockReturnValue({ ...baseContext, viewMode: 'showId' });
    render(<App />);

    expect(screen.getByTestId('showid-page')).toBeInTheDocument();
    expect(screen.queryByTestId('rank-page')).not.toBeInTheDocument();
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

  it('renders PhotoModal and SubmitModal', () => {
    render(<App />);

    expect(screen.getByTestId('photo-modal')).toBeInTheDocument();
    expect(screen.getByTestId('submit-modal')).toBeInTheDocument();
  });
});

describe('Admin vs regular user', () => {
  it('shows Scan Photos and Users buttons for admin users', () => {
    render(<App />);

    expect(screen.getByText('Scan Photos')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('hides Scan Photos and Users buttons for non-admin users', () => {
    useAuth.mockReturnValue({ user: regularUser, logout: vi.fn() });
    render(<App />);

    expect(screen.queryByText('Scan Photos')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('shows Submit to Show button for all users', () => {
    useAuth.mockReturnValue({ user: regularUser, logout: vi.fn() });
    render(<App />);

    expect(screen.getByText('Submit to Show')).toBeInTheDocument();
  });
});
