import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoModal from './PhotoModal.jsx';
import { usePhotos } from '../context/PhotoContext.jsx';

vi.mock('../context/PhotoContext.jsx', () => ({
  usePhotos: vi.fn(),
}));

vi.mock('../api/photos.js', () => ({
  fullImageUrl: (id) => `/api/photos/${id}/full`,
}));

const photos = [
  { id: 1, title: 'First', artist: 'Alice', tag: 'love', medium: 'Oil', dimensions: '24x36', show_id: '042' },
  { id: 2, title: 'Second', artist: 'Bob', tag: 'like', medium: 'Acrylic', dimensions: '18x24', show_id: '099' },
  { id: 3, title: 'Third', artist: null, tag: 'unrated', medium: null, dimensions: null, show_id: null },
];

const baseContext = {
  selectedPhoto: null,
  setSelectedPhoto: vi.fn(),
  photos,
  tagPhoto: vi.fn(),
};

beforeEach(() => {
  vi.restoreAllMocks();
  usePhotos.mockReturnValue({ ...baseContext });
  cleanup();
});

describe('PhotoModal', () => {
  it('renders nothing when no photo is selected', () => {
    const { container } = render(<PhotoModal />);

    expect(container.innerHTML).toBe('');
  });

  it('renders modal with photo details when selected', () => {
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0] });
    render(<PhotoModal />);

    expect(screen.getByAltText('First')).toHaveAttribute('src', '/api/photos/1/full');
    expect(screen.getByText('#042')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Oil')).toBeInTheDocument();
    expect(screen.getByText('24x36')).toBeInTheDocument();
  });

  it('hides optional metadata when not present', () => {
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[2] });
    render(<PhotoModal />);

    expect(screen.getByText('Third')).toBeInTheDocument();
    expect(screen.queryByText('#042')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    // No separator dot when no medium/dimensions
    expect(screen.queryByText('·')).not.toBeInTheDocument();
  });

  it('marks active tag button', () => {
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0] });
    render(<PhotoModal />);

    expect(screen.getByTitle('Love').className).toContain('active');
    expect(screen.getByTitle('Like').className).not.toContain('active');
  });

  it('tags photo when tag button is clicked', async () => {
    const tagPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0], tagPhoto });
    const user = userEvent.setup();

    render(<PhotoModal />);
    await user.click(screen.getByTitle('Meh'));

    expect(tagPhoto).toHaveBeenCalledWith(1, 'meh');
  });

  it('untags photo when active tag is clicked', async () => {
    const tagPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0], tagPhoto });
    const user = userEvent.setup();

    render(<PhotoModal />);
    await user.click(screen.getByTitle('Love'));

    expect(tagPhoto).toHaveBeenCalledWith(1, 'unrated');
  });

  it('closes modal when overlay is clicked', async () => {
    const setSelectedPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0], setSelectedPhoto });
    const user = userEvent.setup();

    render(<PhotoModal />);
    await user.click(screen.getByAltText('First').closest('.modal-overlay'));

    expect(setSelectedPhoto).toHaveBeenCalledWith(null);
  });

  it('does not close when modal content is clicked', async () => {
    const setSelectedPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0], setSelectedPhoto });
    const user = userEvent.setup();

    render(<PhotoModal />);
    await user.click(screen.getByAltText('First'));

    expect(setSelectedPhoto).not.toHaveBeenCalled();
  });

  it('closes modal on Escape key', async () => {
    const setSelectedPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0], setSelectedPhoto });
    const user = userEvent.setup();

    render(<PhotoModal />);
    await user.keyboard('{Escape}');

    expect(setSelectedPhoto).toHaveBeenCalledWith(null);
  });

  it('shows next/prev buttons for middle photo', () => {
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[1] });
    render(<PhotoModal />);

    expect(screen.getByText('‹')).toBeInTheDocument();
    expect(screen.getByText('›')).toBeInTheDocument();
  });

  it('hides prev button for first photo', () => {
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0] });
    render(<PhotoModal />);

    expect(screen.queryByText('‹')).not.toBeInTheDocument();
    expect(screen.getByText('›')).toBeInTheDocument();
  });

  it('hides next button for last photo', () => {
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[2] });
    render(<PhotoModal />);

    expect(screen.getByText('‹')).toBeInTheDocument();
    expect(screen.queryByText('›')).not.toBeInTheDocument();
  });

  it('navigates to next photo on button click', async () => {
    const setSelectedPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[0], setSelectedPhoto });
    const user = userEvent.setup();

    render(<PhotoModal />);
    await user.click(screen.getByText('›'));

    expect(setSelectedPhoto).toHaveBeenCalledWith(photos[1]);
  });

  it('navigates to prev photo on button click', async () => {
    const setSelectedPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[1], setSelectedPhoto });
    const user = userEvent.setup();

    render(<PhotoModal />);
    await user.click(screen.getByText('‹'));

    expect(setSelectedPhoto).toHaveBeenCalledWith(photos[0]);
  });

  it('navigates with arrow keys', async () => {
    const setSelectedPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...baseContext, selectedPhoto: photos[1], setSelectedPhoto });
    const user = userEvent.setup();

    render(<PhotoModal />);
    await user.keyboard('{ArrowRight}');
    expect(setSelectedPhoto).toHaveBeenCalledWith(photos[2]);

    setSelectedPhoto.mockClear();
    await user.keyboard('{ArrowLeft}');
    expect(setSelectedPhoto).toHaveBeenCalledWith(photos[0]);
  });

  it('reflects updated photo data from photos array', () => {
    const updatedPhotos = [
      { id: 1, title: 'First', artist: 'Alice', tag: 'meh', medium: 'Oil', dimensions: '24x36' },
      ...photos.slice(1),
    ];
    usePhotos.mockReturnValue({
      ...baseContext,
      selectedPhoto: { id: 1 },
      photos: updatedPhotos,
    });
    render(<PhotoModal />);

    // Should pick up the updated tag from the photos array
    expect(screen.getByTitle('Meh').className).toContain('active');
    expect(screen.getByTitle('Love').className).not.toContain('active');
  });
});
