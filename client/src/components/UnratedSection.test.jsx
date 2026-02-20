import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import UnratedSection from './UnratedSection.jsx';

vi.mock('./PhotoGrid.jsx', () => ({
  default: ({ photos, draggable }) => (
    <div data-testid="photo-grid" data-draggable={String(draggable)} data-count={photos.length}>
      {photos.map((p) => (
        <div key={p.id} data-testid={`photo-${p.id}`} data-show-id={p.show_id} />
      ))}
    </div>
  ),
}));

const photos = [
  { id: 1, title: 'A', tag: 'unrated', show_id: '010' },
  { id: 2, title: 'B', tag: 'unrated', show_id: '020' },
];

beforeEach(() => {
  cleanup();
});

describe('UnratedSection', () => {
  it('renders nothing when photos array is empty', () => {
    const { container } = render(<UnratedSection photos={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders section with unrated class', () => {
    const { container } = render(<UnratedSection photos={photos} />);

    const section = container.querySelector('section');
    expect(section.className).toContain('tag-group-unrated');
  });

  it('renders Unrated heading', () => {
    render(<UnratedSection photos={photos} />);

    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });

  it('passes photos and draggable=false to PhotoGrid', () => {
    render(<UnratedSection photos={photos} />);

    const grid = screen.getByTestId('photo-grid');
    expect(grid).toHaveAttribute('data-draggable', 'false');
    expect(grid).toHaveAttribute('data-count', '2');
  });

  it('preserves show_id order of photos', () => {
    const unordered = [
      { id: 3, title: 'C', tag: 'unrated', show_id: '050' },
      { id: 1, title: 'A', tag: 'unrated', show_id: '010' },
      { id: 2, title: 'B', tag: 'unrated', show_id: '030' },
    ];

    render(<UnratedSection photos={unordered} />);

    const grid = screen.getByTestId('photo-grid');
    const rendered = Array.from(grid.children).map((el) => el.getAttribute('data-show-id'));

    expect(rendered).toEqual(['050', '010', '030']);
  });
});
