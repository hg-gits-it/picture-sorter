import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TagGroup from './TagGroup.jsx';

vi.mock('./PhotoGrid.jsx', () => ({
  default: ({ photos, draggable }) => (
    <div data-testid="photo-grid" data-draggable={String(draggable)} data-count={photos.length} />
  ),
}));

const photos = [
  { id: 1, title: 'A', tag: 'love' },
  { id: 2, title: 'B', tag: 'love' },
];

beforeEach(() => {
  cleanup();
});

describe('TagGroup', () => {
  it('renders nothing when photos array is empty', () => {
    const { container } = render(<TagGroup tag="love" photos={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders section with tag-specific class', () => {
    const { container } = render(<TagGroup tag="love" photos={photos} />);

    const section = container.querySelector('section');
    expect(section.className).toContain('tag-group-love');
  });

  it('renders correct heading for love tag', () => {
    render(<TagGroup tag="love" photos={photos} />);

    expect(screen.getByText('Love')).toBeInTheDocument();
  });

  it('renders correct heading for like tag', () => {
    render(<TagGroup tag="like" photos={photos} />);

    expect(screen.getByText('Like')).toBeInTheDocument();
  });

  it('renders correct heading for meh tag', () => {
    render(<TagGroup tag="meh" photos={photos} />);

    expect(screen.getByText('Meh')).toBeInTheDocument();
  });

  it('renders correct heading for pass tag', () => {
    render(<TagGroup tag="pass" photos={photos} />);

    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('passes photos and draggable=true to PhotoGrid', () => {
    render(<TagGroup tag="love" photos={photos} />);

    const grid = screen.getByTestId('photo-grid');
    expect(grid).toHaveAttribute('data-draggable', 'true');
    expect(grid).toHaveAttribute('data-count', '2');
  });
});
