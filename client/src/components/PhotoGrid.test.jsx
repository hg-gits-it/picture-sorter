import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import PhotoGrid from './PhotoGrid.jsx';
import { usePhotos } from '../context/PhotoContext.jsx';

vi.mock('../context/PhotoContext.jsx', () => ({
  usePhotos: vi.fn(),
}));

// Mock PhotoCard to expose drag handlers for testing
vi.mock('./PhotoCard.jsx', () => ({
  default: ({ photo, draggable, onDragStart, onDragOver, onDrop }) => (
    <div
      data-testid={`card-${photo.id}`}
      data-draggable={String(!!draggable)}
      draggable={draggable || undefined}
      onDragStart={onDragStart ? (e) => onDragStart(e, photo) : undefined}
      onDragOver={onDragOver ? (e) => onDragOver(e, photo) : undefined}
      onDrop={onDrop ? (e) => onDrop(e, photo) : undefined}
    >
      {photo.title}
    </div>
  ),
}));

const photos = [
  { id: 1, title: 'First', tag: 'love', group_position: 1 },
  { id: 2, title: 'Second', tag: 'love', group_position: 2 },
  { id: 3, title: 'Third', tag: 'love', group_position: 3 },
];

const mockContext = {
  reorderPhoto: vi.fn(),
};

beforeEach(() => {
  vi.restoreAllMocks();
  usePhotos.mockReturnValue({ ...mockContext });
  cleanup();
});

describe('PhotoGrid', () => {
  it('renders a card for each photo', () => {
    render(<PhotoGrid photos={photos} draggable />);

    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.getByTestId('card-2')).toBeInTheDocument();
    expect(screen.getByTestId('card-3')).toBeInTheDocument();
  });

  it('renders nothing for empty photos array', () => {
    const { container } = render(<PhotoGrid photos={[]} draggable />);

    expect(container.querySelector('.photo-grid').children).toHaveLength(0);
  });

  it('passes draggable prop to PhotoCard', () => {
    render(<PhotoGrid photos={photos} draggable />);

    expect(screen.getByTestId('card-1')).toHaveAttribute('data-draggable', 'true');
  });

  it('passes draggable=false to PhotoCard when not draggable', () => {
    render(<PhotoGrid photos={photos} draggable={false} />);

    expect(screen.getByTestId('card-1')).toHaveAttribute('data-draggable', 'false');
  });

  it('calls reorderPhoto on drag and drop between different cards', () => {
    const reorderPhoto = vi.fn();
    usePhotos.mockReturnValue({ reorderPhoto });

    render(<PhotoGrid photos={photos} draggable />);

    const card1 = screen.getByTestId('card-1');
    const card3 = screen.getByTestId('card-3');

    // Simulate drag start on card 1
    fireEvent.dragStart(card1, {
      dataTransfer: { effectAllowed: '' },
    });

    // Simulate drag over card 3
    fireEvent.dragOver(card3, {
      dataTransfer: { dropEffect: '' },
    });

    // Simulate drop on card 3
    fireEvent.drop(card3);

    expect(reorderPhoto).toHaveBeenCalledWith(1, 3);
  });

  it('does not reorder when dropping on same card', () => {
    const reorderPhoto = vi.fn();
    usePhotos.mockReturnValue({ reorderPhoto });

    render(<PhotoGrid photos={photos} draggable />);

    const card1 = screen.getByTestId('card-1');

    fireEvent.dragStart(card1, {
      dataTransfer: { effectAllowed: '' },
    });

    fireEvent.drop(card1);

    expect(reorderPhoto).not.toHaveBeenCalled();
  });

  it('does not reorder when drop occurs without prior drag start', () => {
    const reorderPhoto = vi.fn();
    usePhotos.mockReturnValue({ reorderPhoto });

    render(<PhotoGrid photos={photos} draggable />);

    fireEvent.drop(screen.getByTestId('card-2'));

    expect(reorderPhoto).not.toHaveBeenCalled();
  });

  it('sets effectAllowed on drag start', () => {
    render(<PhotoGrid photos={photos} draggable />);

    const dataTransfer = { effectAllowed: '' };
    fireEvent.dragStart(screen.getByTestId('card-1'), { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe('move');
  });

  it('prevents default on drag over', () => {
    render(<PhotoGrid photos={photos} draggable />);

    const event = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { dropEffect: '' },
    });

    const prevented = !screen.getByTestId('card-1').dispatchEvent(event);

    expect(prevented).toBe(true);
  });
});
