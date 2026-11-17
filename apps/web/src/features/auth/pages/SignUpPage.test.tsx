import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '@/test/render';
import { signUp } from '../api/auth-api';
import { SignUpPage } from './SignUpPage';

vi.mock('../api/auth-api', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

const mockedSignUp = vi.mocked(signUp);

function renderSignUpPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={['/signup']}>
      <SignUpPage />
    </MemoryRouter>,
  );
}

describe('SignUpPage', () => {
  beforeEach(() => {
    mockedSignUp.mockReset();
  });

  it('validates the form before submitting', async () => {
    const user = userEvent.setup();
    renderSignUpPage();

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Display name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it('shows an email confirmation state after a successful sign-up', async () => {
    const user = userEvent.setup();
    mockedSignUp.mockResolvedValue({ requiresEmailConfirmation: true });
    renderSignUpPage();

    await user.type(screen.getByLabelText('Display name'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(mockedSignUp).toHaveBeenCalledWith({
      displayName: 'Alice',
      email: 'alice@example.com',
      password: 'supersecret',
    });
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows sign-up errors', async () => {
    const user = userEvent.setup();
    mockedSignUp.mockRejectedValue(new Error('User already registered'));
    renderSignUpPage();

    await user.type(screen.getByLabelText('Display name'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('User already registered');
  });
});
