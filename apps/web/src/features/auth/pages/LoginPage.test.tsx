import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '@/test/render';
import { signIn } from '../api';
import { LoginPage } from './LoginPage';

vi.mock('../api', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

const mockedSignIn = vi.mocked(signIn);

function renderLoginPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<p>Dashboard destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockedSignIn.mockReset();
  });

  it('shows validation errors without calling the API', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(mockedSignIn).not.toHaveBeenCalled();
  });

  it('signs in and redirects to the dashboard', async () => {
    const user = userEvent.setup();
    mockedSignIn.mockResolvedValue(undefined);
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(mockedSignIn).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'supersecret',
    });
    expect(await screen.findByText('Dashboard destination')).toBeInTheDocument();
  });

  it('shows the authentication error returned by Supabase', async () => {
    const user = userEvent.setup();
    mockedSignIn.mockRejectedValue(new Error('Invalid login credentials'));
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
  });
});
