import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserManagement from './UserManagement.jsx';
import * as api from '../api/photos.js';

vi.mock('../api/photos.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchUsers: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
  };
});

const mockOnClose = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  mockOnClose.mockReset();
  cleanup();
});

describe('UserManagement', () => {
  it('renders user list', async () => {
    api.fetchUsers.mockResolvedValue([
      { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
      { id: 2, username: 'user1', isAdmin: false, createdAt: '2024-01-02' },
    ]);

    render(<UserManagement onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('admin_user')).toBeInTheDocument();
    });

    expect(screen.getByText('user1')).toBeInTheDocument();
  });

  it('shows admin badge for admin users', async () => {
    api.fetchUsers.mockResolvedValue([
      { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
    ]);

    render(<UserManagement onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('admin_user')).toBeInTheDocument();
    });

    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('does not show delete button for admin users', async () => {
    api.fetchUsers.mockResolvedValue([
      { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
    ]);

    render(<UserManagement onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('admin_user')).toBeInTheDocument();
    });

    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows delete button for non-admin users', async () => {
    api.fetchUsers.mockResolvedValue([
      { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
      { id: 2, username: 'user1', isAdmin: false, createdAt: '2024-01-02' },
    ]);

    render(<UserManagement onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('creates a new user', async () => {
    const user = userEvent.setup();
    api.fetchUsers
      .mockResolvedValueOnce([
        { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
      ])
      .mockResolvedValueOnce([
        { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
        { id: 2, username: 'newuser', isAdmin: false, createdAt: '2024-01-02' },
      ]);
    api.createUser.mockResolvedValue({ id: 2, username: 'newuser', isAdmin: false });

    render(<UserManagement onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('admin_user')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('New username'), 'newuser');
    await user.click(screen.getByText('Add User'));

    expect(api.createUser).toHaveBeenCalledWith('newuser');

    await waitFor(() => {
      expect(screen.getByText('newuser')).toBeInTheDocument();
    });
  });

  it('deletes a user', async () => {
    const user = userEvent.setup();
    api.fetchUsers
      .mockResolvedValueOnce([
        { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
        { id: 2, username: 'todelete', isAdmin: false, createdAt: '2024-01-02' },
      ])
      .mockResolvedValueOnce([
        { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
      ]);
    api.deleteUser.mockResolvedValue({ ok: true });

    render(<UserManagement onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('todelete')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));

    expect(api.deleteUser).toHaveBeenCalledWith(2);
  });

  it('displays error on create failure', async () => {
    const user = userEvent.setup();
    api.fetchUsers.mockResolvedValue([
      { id: 1, username: 'admin_user', isAdmin: true, createdAt: '2024-01-01' },
    ]);
    api.createUser.mockRejectedValue(new Error('Username already taken'));

    render(<UserManagement onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('admin_user')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('New username'), 'someone');
    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Username already taken')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    api.fetchUsers.mockResolvedValue([]);

    render(<UserManagement onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Manage Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('\u00d7'));

    expect(mockOnClose).toHaveBeenCalled();
  });
});
