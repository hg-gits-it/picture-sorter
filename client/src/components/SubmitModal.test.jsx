import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubmitModal from './SubmitModal.jsx';
import * as api from '../api/photos.js';

vi.mock('../api/photos.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    startSubmit: vi.fn(),
  };
});

let capturedOnMessage;

beforeEach(() => {
  vi.restoreAllMocks();
  capturedOnMessage = null;
  // By default, startSubmit captures onMessage and returns a pending promise
  api.startSubmit.mockImplementation((codename, { onMessage }) => {
    capturedOnMessage = onMessage;
    return new Promise(() => {}); // never resolves unless we want it to
  });
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
  cleanup();
});

describe('SubmitModal', () => {
  it('renders nothing when not open', () => {
    const { container } = render(<SubmitModal open={false} onClose={vi.fn()} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders idle state with codename input', () => {
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    expect(screen.getByText('Submit to Show')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your codename')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeDisabled();
  });

  it('enables submit button when codename is entered', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');

    expect(screen.getByText('Submit')).not.toBeDisabled();
  });

  it('does not submit when codename is blank', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.click(screen.getByText('Submit'));

    expect(api.startSubmit).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={onClose} />);

    await user.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked in idle state', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={onClose} />);

    await user.click(screen.getByText('Submit to Show').closest('.modal-overlay'));

    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape in idle state', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('calls startSubmit with codename on submit', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    expect(api.startSubmit).toHaveBeenCalledWith('alice', expect.objectContaining({
      onMessage: expect.any(Function),
      signal: expect.any(AbortSignal),
    }));
  });

  it('submits on Enter key in codename input', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice{Enter}');

    expect(api.startSubmit).toHaveBeenCalled();
  });

  it('shows progress during submission', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    expect(screen.getByText('Starting...')).toBeInTheDocument();

    await act(() => {
      capturedOnMessage({ step: 'progress', message: 'Submitting artwork 1', current: 1, total: 3 });
    });

    expect(screen.getByText('1 / 3 artworks')).toBeInTheDocument();
    expect(screen.getByText('Submitting artwork 1')).toBeInTheDocument();
  });

  it('shows done state after completion', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    await act(() => {
      capturedOnMessage({ step: 'progress', message: 'Submitted 1', current: 1, total: 1 });
      capturedOnMessage({ step: 'done', message: 'All done! 1 artwork submitted.' });
    });

    expect(screen.getByText('All done! 1 artwork submitted.', { selector: '.submit-result-message' })).toBeInTheDocument();
    expect(screen.getByText('\u2713')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('shows error state on error message', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    await act(() => {
      capturedOnMessage({ step: 'error', message: 'Login failed' });
    });

    expect(screen.getByText('Login failed', { selector: '.submit-result-message' })).toBeInTheDocument();
    expect(screen.getByText('\u2717')).toBeInTheDocument();
  });

  it('does not close on overlay click during submission', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    const overlay = screen.getByText('Starting...').closest('.modal-overlay');
    await user.click(overlay);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on Escape during submission', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes and resets after clicking Close on done state', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    await act(() => {
      capturedOnMessage({ step: 'done', message: 'All done!' });
    });

    await user.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
