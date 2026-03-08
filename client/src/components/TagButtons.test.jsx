import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagButtons from './TagButtons.jsx';

afterEach(cleanup);

describe('TagButtons', () => {
  it('renders four tag buttons', () => {
    render(<TagButtons currentTag="unrated" onTag={() => {}} />);
    expect(screen.getByTitle('Love')).toBeInTheDocument();
    expect(screen.getByTitle('Like')).toBeInTheDocument();
    expect(screen.getByTitle('Meh')).toBeInTheDocument();
    expect(screen.getByTitle('Pass')).toBeInTheDocument();
  });

  it('marks the active tag button', () => {
    render(<TagButtons currentTag="like" onTag={() => {}} />);
    expect(screen.getByTitle('Like')).toHaveClass('active');
    expect(screen.getByTitle('Love')).not.toHaveClass('active');
    expect(screen.getByTitle('Meh')).not.toHaveClass('active');
    expect(screen.getByTitle('Pass')).not.toHaveClass('active');
  });

  it('calls onTag with the tag key when clicked', async () => {
    const user = userEvent.setup();
    const onTag = vi.fn();
    render(<TagButtons currentTag="unrated" onTag={onTag} />);

    await user.click(screen.getByTitle('Love'));
    expect(onTag).toHaveBeenCalledWith('love');

    await user.click(screen.getByTitle('Meh'));
    expect(onTag).toHaveBeenCalledWith('meh');
  });

  it('applies the tag key as a CSS class on each button', () => {
    render(<TagButtons currentTag="unrated" onTag={() => {}} />);
    expect(screen.getByTitle('Love')).toHaveClass('tag-btn', 'love');
    expect(screen.getByTitle('Like')).toHaveClass('tag-btn', 'like');
    expect(screen.getByTitle('Meh')).toHaveClass('tag-btn', 'meh');
    expect(screen.getByTitle('Pass')).toHaveClass('tag-btn', 'pass');
  });

  it('renders no active button when currentTag is unrated', () => {
    render(<TagButtons currentTag="unrated" onTag={() => {}} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).not.toHaveClass('active'));
  });
});
