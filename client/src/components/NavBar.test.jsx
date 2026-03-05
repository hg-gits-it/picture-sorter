import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavBar from './NavBar.jsx';
import { usePhotos } from '../context/PhotoContext.jsx';

vi.mock('../context/PhotoContext.jsx', () => ({
  usePhotos: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('NavBar', () => {
  it('renders both tab buttons', () => {
    usePhotos.mockReturnValue({ viewMode: 'rank', setViewMode: vi.fn() });
    render(<NavBar />);

    expect(screen.getByText('By Rank')).toBeInTheDocument();
    expect(screen.getByText('By Show ID')).toBeInTheDocument();
  });

  it('highlights By Rank tab when viewMode is rank', () => {
    usePhotos.mockReturnValue({ viewMode: 'rank', setViewMode: vi.fn() });
    render(<NavBar />);

    expect(screen.getByText('By Rank')).toHaveClass('active');
    expect(screen.getByText('By Show ID')).not.toHaveClass('active');
  });

  it('highlights By Show ID tab when viewMode is showId', () => {
    usePhotos.mockReturnValue({ viewMode: 'showId', setViewMode: vi.fn() });
    render(<NavBar />);

    expect(screen.getByText('By Show ID')).toHaveClass('active');
    expect(screen.getByText('By Rank')).not.toHaveClass('active');
  });

  it('calls setViewMode with showId when By Show ID is clicked', async () => {
    const setViewMode = vi.fn();
    usePhotos.mockReturnValue({ viewMode: 'rank', setViewMode });
    render(<NavBar />);

    await userEvent.click(screen.getByText('By Show ID'));

    expect(setViewMode).toHaveBeenCalledWith('showId');
  });

  it('calls setViewMode with rank when By Rank is clicked', async () => {
    const setViewMode = vi.fn();
    usePhotos.mockReturnValue({ viewMode: 'showId', setViewMode });
    render(<NavBar />);

    await userEvent.click(screen.getByText('By Rank'));

    expect(setViewMode).toHaveBeenCalledWith('rank');
  });
});
