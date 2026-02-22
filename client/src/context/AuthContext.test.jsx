import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import * as api from '../api/photos.js';

vi.mock('../api/photos.js', () => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

function TestConsumer() {
  const { user, loading, login, register, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user ? user.username : 'null'}</div>
      <button onClick={() => login('alice', 'pass')}>login</button>
      <button onClick={() => register('bob', 'pass')}>register</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthContext', () => {
  it('starts in loading state and resolves with user from fetchMe', async () => {
    api.fetchMe.mockResolvedValue({ id: 1, username: 'alice', isAdmin: true });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('alice');
  });

  it('sets user to null when fetchMe returns null', async () => {
    api.fetchMe.mockResolvedValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('login sets user', async () => {
    api.fetchMe.mockResolvedValue(null);
    api.login.mockResolvedValue({ id: 1, username: 'alice', isAdmin: false });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(api.login).toHaveBeenCalledWith('alice', 'pass');
    expect(screen.getByTestId('user').textContent).toBe('alice');
  });

  it('register sets user', async () => {
    api.fetchMe.mockResolvedValue(null);
    api.register.mockResolvedValue({ id: 2, username: 'bob', isAdmin: true });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByText('register').click();
    });

    expect(api.register).toHaveBeenCalledWith('bob', 'pass');
    expect(screen.getByTestId('user').textContent).toBe('bob');
  });

  it('logout clears user', async () => {
    api.fetchMe.mockResolvedValue({ id: 1, username: 'alice', isAdmin: false });
    api.logout.mockResolvedValue({ ok: true });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('alice');
    });

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
