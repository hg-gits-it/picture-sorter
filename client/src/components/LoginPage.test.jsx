import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api/photos.js';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/photos.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchSetupStatus: vi.fn(),
  };
});

const mockLogin = vi.fn();
const mockSetup = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  mockLogin.mockReset();
  mockSetup.mockReset();
  useAuth.mockReturnValue({ login: mockLogin, setup: mockSetup });
  cleanup();
});

describe('LoginPage - login mode', () => {
  beforeEach(() => {
    api.fetchSetupStatus.mockResolvedValue({ needsSetup: false });
  });

  it('renders login form', async () => {
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText('Art Sorter')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  it('does not show register button', async () => {
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText('Log In')).toBeInTheDocument();
    });

    expect(screen.queryByText('Register')).not.toBeInTheDocument();
  });

  it('calls login on form submit', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ id: 1, username: 'alice' });
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText('Log In')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Username'), 'alice');
    await user.type(screen.getByPlaceholderText('Password'), 'pass1234');
    await user.click(screen.getByText('Log In'));

    expect(mockLogin).toHaveBeenCalledWith('alice', 'pass1234');
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText('Log In')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Username'), 'alice');
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByText('Log In'));

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });
});

describe('LoginPage - setup mode', () => {
  beforeEach(() => {
    api.fetchSetupStatus.mockResolvedValue({ needsSetup: true });
  });

  it('renders setup form when no users exist', async () => {
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText('Initial Setup')).toBeInTheDocument();
    });

    expect(screen.getByText('Create the first admin account to get started.')).toBeInTheDocument();
    expect(screen.getByText('Create Admin Account')).toBeInTheDocument();
  });

  it('calls setup on form submit', async () => {
    const user = userEvent.setup();
    mockSetup.mockResolvedValue({ id: 1, username: 'admin', isAdmin: true });
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText('Create Admin Account')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Username'), 'admin');
    await user.type(screen.getByPlaceholderText('Password'), 'admin1234');
    await user.click(screen.getByText('Create Admin Account'));

    expect(mockSetup).toHaveBeenCalledWith('admin', 'admin1234');
  });

  it('displays error message on setup failure', async () => {
    const user = userEvent.setup();
    mockSetup.mockRejectedValue(new Error('Setup failed'));
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText('Create Admin Account')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Username'), 'admin');
    await user.type(screen.getByPlaceholderText('Password'), 'pass');
    await user.click(screen.getByText('Create Admin Account'));

    expect(screen.getByText('Setup failed')).toBeInTheDocument();
  });
});
