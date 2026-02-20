import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubmitModal from './SubmitModal.jsx';

vi.mock('../api/photos.js', () => ({
  submitUrl: (codename) => `/api/submit?codename=${codename}`,
}));

// Mock EventSource
class MockEventSource {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    this.closed = false;
    MockEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  // Helper to simulate server messages
  _emit(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}
MockEventSource.instances = [];

beforeEach(() => {
  vi.restoreAllMocks();
  MockEventSource.instances = [];
  globalThis.EventSource = MockEventSource;
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

    expect(MockEventSource.instances).toHaveLength(0);
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

  it('creates EventSource with correct URL on submit', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/submit?codename=alice');
  });

  it('submits on Enter key in codename input', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice{Enter}');

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('shows progress during submission', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    expect(screen.getByText('Starting...')).toBeInTheDocument();

    const es = MockEventSource.instances[0];
    await act(() => {
      es._emit({ step: 'progress', message: 'Submitting artwork 1', current: 1, total: 3 });
    });

    expect(screen.getByText('1 / 3 artworks')).toBeInTheDocument();
    expect(screen.getByText('Submitting artwork 1')).toBeInTheDocument();
  });

  it('shows done state after completion', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    const es = MockEventSource.instances[0];
    await act(() => {
      es._emit({ step: 'progress', message: 'Submitted 1', current: 1, total: 1 });
      es._emit({ step: 'done', message: 'All done! 1 artwork submitted.' });
    });

    expect(screen.getByText('All done! 1 artwork submitted.', { selector: '.submit-result-message' })).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(es.closed).toBe(true);
  });

  it('shows error state on error message', async () => {
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    const es = MockEventSource.instances[0];
    await act(() => {
      es._emit({ step: 'error', message: 'Login failed' });
    });

    expect(screen.getByText('Login failed', { selector: '.submit-result-message' })).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
    expect(es.closed).toBe(true);
  });

  it('does not close on overlay click during submission', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SubmitModal open={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('Enter your codename'), 'alice');
    await user.click(screen.getByText('Submit'));

    // The overlay click handler is disabled during submitting
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

    const es = MockEventSource.instances[0];
    await act(() => {
      es._emit({ step: 'done', message: 'All done!' });
    });

    await user.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
