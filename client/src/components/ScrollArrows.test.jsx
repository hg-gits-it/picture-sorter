import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScrollArrows from './ScrollArrows.jsx';

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('ScrollArrows', () => {
  it('renders up and down arrow buttons', () => {
    render(<ScrollArrows />);

    expect(screen.getByTitle('Scroll to top')).toBeInTheDocument();
    expect(screen.getByTitle('Scroll to bottom')).toBeInTheDocument();
  });

  it('scrolls to top when up arrow is clicked', async () => {
    const user = userEvent.setup();
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<ScrollArrows />);

    await user.click(screen.getByTitle('Scroll to top'));

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('scrolls to bottom when down arrow is clicked without downRef', async () => {
    const user = userEvent.setup();
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<ScrollArrows />);

    await user.click(screen.getByTitle('Scroll to bottom'));

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: document.body.scrollHeight,
      behavior: 'smooth',
    });
  });

  it('scrolls to ref element when down arrow is clicked with downRef', async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();
    const ref = { current: { scrollIntoView: scrollIntoViewMock } };
    render(<ScrollArrows downRef={ref} />);

    await user.click(screen.getByTitle('Scroll to bottom'));

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});
