import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserMenu from './UserMenu.jsx';
import { useAuth } from '../context/AuthContext.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

const mockUser = { username: 'alice', isAdmin: false };

beforeEach(() => {
  vi.restoreAllMocks();
  useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() });
  cleanup();
});

describe('UserMenu', () => {
  it('renders avatar with first initial', () => {
    render(<UserMenu />);

    const avatar = screen.getByTitle('alice');
    expect(avatar).toHaveTextContent('A');
  });

  it('dropdown is hidden by default', () => {
    render(<UserMenu />);

    expect(screen.queryByText('alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Log Out')).not.toBeInTheDocument();
  });

  it('shows dropdown with username and logout on click', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByTitle('alice'));

    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Log Out')).toBeInTheDocument();
  });

  it('closes dropdown on second click', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    const avatar = screen.getByTitle('alice');
    await user.click(avatar);
    expect(screen.getByText('Log Out')).toBeInTheDocument();

    await user.click(avatar);
    expect(screen.queryByText('Log Out')).not.toBeInTheDocument();
  });

  it('calls logout when Log Out is clicked', async () => {
    const logout = vi.fn();
    useAuth.mockReturnValue({ user: mockUser, logout });
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByTitle('alice'));
    await user.click(screen.getByText('Log Out'));

    expect(logout).toHaveBeenCalled();
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <UserMenu />
        <div data-testid="outside">outside</div>
      </div>,
    );

    await user.click(screen.getByTitle('alice'));
    expect(screen.getByText('Log Out')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('Log Out')).not.toBeInTheDocument();
  });
});
