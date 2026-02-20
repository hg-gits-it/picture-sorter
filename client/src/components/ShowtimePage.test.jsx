import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShowtimePage from './ShowtimePage.jsx';
import * as api from '../api/photos.js';

vi.mock('../api/photos.js', () => ({
  fetchShowtimePhotos: vi.fn(),
  takePhoto: vi.fn(),
  restorePhoto: vi.fn(),
  thumbnailUrl: (flickrId) => `/thumbnails/${flickrId}.jpg`,
  fullImageUrl: (id) => `/api/photos/${id}/full`,
}));

const availablePhotos = [
  { id: 1, show_id: '042', title: 'Sunset', artist: 'Alice', tag: 'love', medium: 'Oil', dimensions: '24x36', flickr_id: 'f1', taken: 0 },
  { id: 2, show_id: '099', title: 'Mountain', artist: 'Bob', tag: 'like', medium: 'Acrylic', dimensions: '18x24', flickr_id: 'f2', taken: 0 },
];

const takenPhotos = [
  { id: 3, show_id: '007', title: 'River', artist: 'Carol', tag: 'meh', medium: 'Watercolor', dimensions: '12x16', flickr_id: 'f3', taken: 1 },
];

const allPhotos = [...availablePhotos, ...takenPhotos];

beforeEach(() => {
  vi.restoreAllMocks();
  api.fetchShowtimePhotos.mockResolvedValue({ photos: allPhotos });
  api.takePhoto.mockResolvedValue({});
  api.restorePhoto.mockResolvedValue({});
  Element.prototype.scrollIntoView = vi.fn();
  cleanup();
});

describe('ShowtimePage', () => {
  it('shows loading state initially', () => {
    api.fetchShowtimePhotos.mockReturnValue(new Promise(() => {}));
    render(<ShowtimePage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders available and taken photos after loading', async () => {
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByText('Sunset')).toBeInTheDocument();
    });

    expect(screen.getByText('Mountain')).toBeInTheDocument();
    expect(screen.getByText('River')).toBeInTheDocument();
    expect(screen.getByText('Taken')).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    api.fetchShowtimePhotos.mockRejectedValue(new Error('Network error'));
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load photos')).toBeInTheDocument();
    });
  });

  it('renders photo metadata in rows', async () => {
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByText('#042')).toBeInTheDocument();
    });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Oil')).toBeInTheDocument();
    expect(screen.getByText('24x36')).toBeInTheDocument();
  });

  it('does not show Taken section when no photos are taken', async () => {
    api.fetchShowtimePhotos.mockResolvedValue({ photos: availablePhotos });
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByText('Sunset')).toBeInTheDocument();
    });

    expect(screen.queryByText('Taken')).not.toBeInTheDocument();
  });

  it('shows Restore button only for taken photos', async () => {
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByText('Sunset')).toBeInTheDocument();
    });

    const restoreButtons = screen.getAllByText('Restore');
    expect(restoreButtons).toHaveLength(1);
  });

  it('shows confirm dialog when claiming an available photo', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '42');
    await user.click(screen.getByText('Claim'));

    expect(screen.getByText('Confirm Claim')).toBeInTheDocument();
    const confirmImg = screen.getByText('Confirm Claim').closest('.showtime-confirm').querySelector('img');
    expect(confirmImg).toHaveAttribute('src', '/api/photos/1/full');
  });

  it('shows restore confirm dialog when claiming a taken photo', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '7');
    await user.click(screen.getByText('Claim'));

    const dialogRestore = screen.getByText('Restore', { selector: '.showtime-restore-confirm-btn' });
    expect(dialogRestore).toBeInTheDocument();
  });

  it('shows error for non-existent artwork number', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '999');
    await user.click(screen.getByText('Claim'));

    expect(screen.getByText('No artwork found with number 999')).toBeInTheDocument();
  });

  it('does nothing when claiming with empty input', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Claim'));

    expect(screen.queryByText('Confirm Claim')).not.toBeInTheDocument();
  });

  it('calls takePhoto and reloads on confirm', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '42');
    await user.click(screen.getByText('Claim'));

    api.fetchShowtimePhotos.mockClear();

    await user.click(screen.getByText('Confirm Claim'));

    expect(api.takePhoto).toHaveBeenCalledWith(1);
    await waitFor(() => {
      expect(api.fetchShowtimePhotos).toHaveBeenCalled();
    });
  });

  it('calls restorePhoto via confirm dialog for taken photo', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '7');
    await user.click(screen.getByText('Claim'));

    // The confirm dialog for a taken photo shows "Restore"
    // There are multiple "Restore" buttons (one in taken list, one in dialog)
    const restoreButtons = screen.getAllByText('Restore');
    const dialogRestore = restoreButtons.find(
      (btn) => btn.closest('.showtime-confirm-actions'),
    );

    await user.click(dialogRestore);

    expect(api.restorePhoto).toHaveBeenCalledWith(3);
  });

  it('dismisses confirm dialog on Cancel', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '42');
    await user.click(screen.getByText('Claim'));

    expect(screen.getByText('Confirm Claim')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Confirm Claim')).not.toBeInTheDocument();
  });

  it('dismisses confirm dialog on overlay click', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '42');
    await user.click(screen.getByText('Claim'));

    await user.click(screen.getByText('Confirm Claim').closest('.modal-overlay'));

    expect(screen.queryByText('Confirm Claim')).not.toBeInTheDocument();
  });

  it('calls restorePhoto from Restore button in taken list', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByText('River')).toBeInTheDocument();
    });

    const restoreBtn = screen.getByText('River')
      .closest('.showtime-row')
      .querySelector('.showtime-restore-btn');

    api.fetchShowtimePhotos.mockClear();

    await user.click(restoreBtn);

    expect(api.restorePhoto).toHaveBeenCalledWith(3);
    await waitFor(() => {
      expect(api.fetchShowtimePhotos).toHaveBeenCalled();
    });
  });

  it('shows toast after claiming and hides after undo', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '42');
    await user.click(screen.getByText('Claim'));
    await user.click(screen.getByText('Confirm Claim'));

    await waitFor(() => {
      expect(screen.getByText('Claimed #042')).toBeInTheDocument();
    });

    expect(screen.getByText('Undo')).toBeInTheDocument();

    api.fetchShowtimePhotos.mockClear();
    api.restorePhoto.mockClear();

    await user.click(screen.getByText('Undo'));

    expect(api.restorePhoto).toHaveBeenCalledWith(1);
    await waitFor(() => {
      expect(screen.queryByText('Claimed #042')).not.toBeInTheDocument();
    });
  });

  it('shows error from failed takePhoto', async () => {
    api.takePhoto.mockRejectedValue(new Error('Already taken'));
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Artwork #'), '42');
    await user.click(screen.getByText('Claim'));
    await user.click(screen.getByText('Confirm Claim'));

    await waitFor(() => {
      expect(screen.getByText('Already taken')).toBeInTheDocument();
    });
  });

  it('normalizes show_id for lookup (leading zeros)', async () => {
    const user = userEvent.setup();
    render(<ShowtimePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Artwork #')).toBeInTheDocument();
    });

    // "42" should match show_id "042" via parseInt normalization
    await user.type(screen.getByPlaceholderText('Artwork #'), '42');
    await user.click(screen.getByText('Claim'));

    expect(screen.getByText('Confirm Claim')).toBeInTheDocument();
  });
});
