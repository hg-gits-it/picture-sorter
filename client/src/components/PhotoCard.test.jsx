import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoCard from './PhotoCard.jsx';
import { usePhotos } from '../context/PhotoContext.jsx';

vi.mock('../context/PhotoContext.jsx', () => ({
  usePhotos: vi.fn(),
}));

vi.mock('../api/photos.js', () => ({
  thumbnailUrl: (flickrId) => `/thumbnails/${flickrId}.jpg`,
}));

const mockContext = {
  tagPhoto: vi.fn(),
  setSelectedPhoto: vi.fn(),
  reorderPhoto: vi.fn(),
};

const basePhoto = {
  id: 1,
  filename: 'test.jpg',
  flickr_id: 'abc123',
  title: 'Sunset Painting',
  artist: 'Jane Doe',
  show_id: '042',
  medium: 'Oil on canvas',
  dimensions: '24x36',
  tag: 'love',
  group_position: 3,
  taken: 0,
};

beforeEach(() => {
  vi.restoreAllMocks();
  usePhotos.mockReturnValue({ ...mockContext });
  cleanup();
});

describe('PhotoCard', () => {
  it('renders photo metadata', () => {
    render(<PhotoCard photo={basePhoto} />);

    expect(screen.getByText('Sunset Painting')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('#042')).toBeInTheDocument();
    expect(screen.getByText('Oil on canvas')).toBeInTheDocument();
    expect(screen.getByText('24x36')).toBeInTheDocument();
  });

  it('renders thumbnail with correct src', () => {
    render(<PhotoCard photo={basePhoto} />);

    const img = screen.getByAltText('Sunset Painting');
    expect(img).toHaveAttribute('src', '/thumbnails/abc123.jpg');
  });

  it('shows Claimed overlay when photo is taken', () => {
    render(<PhotoCard photo={{ ...basePhoto, taken: 1 }} />);

    expect(screen.getByText('Claimed')).toBeInTheDocument();
  });

  it('does not show Claimed overlay when photo is not taken', () => {
    render(<PhotoCard photo={basePhoto} />);

    expect(screen.queryByText('Claimed')).not.toBeInTheDocument();
  });

  it('opens modal when image is clicked', async () => {
    const setSelectedPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...mockContext, setSelectedPhoto });
    const user = userEvent.setup();

    render(<PhotoCard photo={basePhoto} />);
    await user.click(screen.getByAltText('Sunset Painting'));

    expect(setSelectedPhoto).toHaveBeenCalledWith(basePhoto);
  });

  it('marks active tag button', () => {
    render(<PhotoCard photo={{ ...basePhoto, tag: 'like' }} />);

    const likeBtn = screen.getByTitle('Like');
    const loveBtn = screen.getByTitle('Love');

    expect(likeBtn.className).toContain('active');
    expect(loveBtn.className).not.toContain('active');
  });

  it('tags photo when tag button is clicked', async () => {
    const tagPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...mockContext, tagPhoto });
    const user = userEvent.setup();

    render(<PhotoCard photo={{ ...basePhoto, tag: 'unrated' }} />);
    await user.click(screen.getByTitle('Love'));

    expect(tagPhoto).toHaveBeenCalledWith(1, 'love');
  });

  it('untags photo (sets unrated) when active tag is clicked again', async () => {
    const tagPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...mockContext, tagPhoto });
    const user = userEvent.setup();

    render(<PhotoCard photo={{ ...basePhoto, tag: 'love' }} />);
    await user.click(screen.getByTitle('Love'));

    expect(tagPhoto).toHaveBeenCalledWith(1, 'unrated');
  });

  it('shows group position for tagged photos', () => {
    render(<PhotoCard photo={basePhoto} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not show group position for unrated photos', () => {
    render(<PhotoCard photo={{ ...basePhoto, tag: 'unrated', group_position: null }} />);

    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('enters edit mode when position is clicked and reorders on blur', async () => {
    const reorderPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...mockContext, reorderPhoto });
    const user = userEvent.setup();

    render(<PhotoCard photo={basePhoto} />);

    // Click the position to enter edit mode
    await user.click(screen.getByText('3'));

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(3);

    // Clear and type new value, then blur
    await user.clear(input);
    await user.type(input, '7');
    await user.tab();

    expect(reorderPhoto).toHaveBeenCalledWith(1, 7);
  });

  it('does not reorder when position is unchanged', async () => {
    const reorderPhoto = vi.fn();
    usePhotos.mockReturnValue({ ...mockContext, reorderPhoto });
    const user = userEvent.setup();

    render(<PhotoCard photo={basePhoto} />);
    await user.click(screen.getByText('3'));

    screen.getByRole('spinbutton');
    await user.tab();

    expect(reorderPhoto).not.toHaveBeenCalled();
  });

  it('cancels edit on Escape', async () => {
    const user = userEvent.setup();

    render(<PhotoCard photo={basePhoto} />);
    await user.click(screen.getByText('3'));

    expect(screen.getByRole('spinbutton')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides optional metadata when not present', () => {
    const minimalPhoto = {
      ...basePhoto,
      artist: null,
      show_id: null,
      medium: null,
      dimensions: null,
    };
    render(<PhotoCard photo={minimalPhoto} />);

    expect(screen.queryByText('#042')).not.toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Oil on canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('24x36')).not.toBeInTheDocument();
  });

  it('adds draggable class and attributes when draggable prop is true', () => {
    const { container } = render(<PhotoCard photo={basePhoto} draggable />);

    const card = container.querySelector('.photo-card');
    expect(card.className).toContain('draggable');
    expect(card).toHaveAttribute('draggable', 'true');
  });

  it('hides rank when showRank is false', () => {
    render(<PhotoCard photo={basePhoto} showRank={false} />);

    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('does not add draggable attributes when draggable prop is false', () => {
    const { container } = render(<PhotoCard photo={basePhoto} />);

    const card = container.querySelector('.photo-card');
    expect(card.className).not.toContain('draggable');
    expect(card).not.toHaveAttribute('draggable');
  });
});
