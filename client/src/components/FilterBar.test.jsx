import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBar from './FilterBar.jsx';
import { usePhotos } from '../context/PhotoContext.jsx';

vi.mock('../context/PhotoContext.jsx', () => ({
  usePhotos: vi.fn(),
}));

const defaultContext = {
  filterTag: 'all',
  setFilterTag: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  counts: { total: 10, love: 3, like: 2, meh: 1, tax_deduction: 1, unrated: 3 },
  hideClaimed: true,
  setHideClaimed: vi.fn(),
};

beforeEach(() => {
  vi.restoreAllMocks();
  usePhotos.mockReturnValue({ ...defaultContext });
  cleanup();
});

describe('FilterBar', () => {
  it('renders all filter buttons with counts', () => {
    render(<FilterBar />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Love')).toBeInTheDocument();
    expect(screen.getByText('Like')).toBeInTheDocument();
    expect(screen.getByText('Meh')).toBeInTheDocument();
    expect(screen.getByText('Tax Deduction')).toBeInTheDocument();
    expect(screen.getByText('Unrated')).toBeInTheDocument();

    // Check counts are rendered
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3', { selector: '.filter-btn.filter-love .filter-count' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('marks active filter button', () => {
    usePhotos.mockReturnValue({ ...defaultContext, filterTag: 'love' });
    render(<FilterBar />);

    const loveBtn = screen.getByText('Love').closest('button');
    const allBtn = screen.getByText('All').closest('button');

    expect(loveBtn.className).toContain('active');
    expect(allBtn.className).not.toContain('active');
  });

  it('calls setFilterTag when a filter button is clicked', async () => {
    const setFilterTag = vi.fn();
    usePhotos.mockReturnValue({ ...defaultContext, setFilterTag });
    const user = userEvent.setup();

    render(<FilterBar />);
    await user.click(screen.getByText('Love').closest('button'));

    expect(setFilterTag).toHaveBeenCalledWith('love');
  });

  it('calls setFilterTag("all") when All is clicked', async () => {
    const setFilterTag = vi.fn();
    usePhotos.mockReturnValue({ ...defaultContext, filterTag: 'love', setFilterTag });
    const user = userEvent.setup();

    render(<FilterBar />);
    await user.click(screen.getByText('All').closest('button'));

    expect(setFilterTag).toHaveBeenCalledWith('all');
  });

  it('renders search input with current query', () => {
    usePhotos.mockReturnValue({ ...defaultContext, searchQuery: 'sunset' });
    render(<FilterBar />);

    expect(screen.getByPlaceholderText('Search...')).toHaveValue('sunset');
  });

  it('calls setSearchQuery on search input change', async () => {
    const setSearchQuery = vi.fn();
    usePhotos.mockReturnValue({ ...defaultContext, setSearchQuery });
    const user = userEvent.setup();

    render(<FilterBar />);
    await user.type(screen.getByPlaceholderText('Search...'), 'a');

    expect(setSearchQuery).toHaveBeenCalledWith('a');
  });

  it('renders hide claimed checkbox checked by default', () => {
    render(<FilterBar />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('calls setHideClaimed when checkbox is toggled', async () => {
    const setHideClaimed = vi.fn();
    usePhotos.mockReturnValue({ ...defaultContext, setHideClaimed });
    const user = userEvent.setup();

    render(<FilterBar />);
    await user.click(screen.getByRole('checkbox'));

    expect(setHideClaimed).toHaveBeenCalledWith(false);
  });

  it('shows 0 for missing count keys', () => {
    usePhotos.mockReturnValue({
      ...defaultContext,
      counts: { total: 5, love: 0, like: 0, meh: 0, tax_deduction: 0, unrated: 5 },
    });
    render(<FilterBar />);

    const loveBtn = screen.getByText('Love').closest('button');
    const countSpan = loveBtn.querySelector('.filter-count');
    expect(countSpan.textContent).toBe('0');
  });
});
