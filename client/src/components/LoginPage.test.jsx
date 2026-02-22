import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage.jsx';
import { useAuth } from '../context/AuthContext.jsx';

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

const mockLogin = vi.fn();
const mockRegister = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  mockLogin.mockReset();
  mockRegister.mockReset();
  useAuth.mockReturnValue({ login: mockLogin, register: mockRegister });
  cleanup();
});

describe('LoginPage', () => {
  it('renders login form', () => {
    render(<LoginPage />);

    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  it('calls login on form submit', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ id: 1, username: 'alice' });
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('Username'), 'alice');
    await user.type(screen.getByPlaceholderText('Password'), 'pass1234');
    await user.click(screen.getByText('Log In'));

    expect(mockLogin).toHaveBeenCalledWith('alice', 'pass1234');
  });

  it('calls register on register button click', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue({ id: 1, username: 'alice' });
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('Username'), 'alice');
    await user.type(screen.getByPlaceholderText('Password'), 'pass1234');
    await user.click(screen.getByText('Register'));

    expect(mockRegister).toHaveBeenCalledWith('alice', 'pass1234');
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('Username'), 'alice');
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByText('Log In'));

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('displays error message on register failure', async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValue(new Error('Username taken'));
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('Username'), 'alice');
    await user.type(screen.getByPlaceholderText('Password'), 'pass1234');
    await user.click(screen.getByText('Register'));

    expect(screen.getByText('Username taken')).toBeInTheDocument();
  });
});
