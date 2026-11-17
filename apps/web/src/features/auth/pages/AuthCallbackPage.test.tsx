import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from '../session/auth-context';
import { AuthCallbackPage } from './AuthCallbackPage';

function renderCallback(path = '/auth/callback', overrides: Partial<AuthContextValue> = {}) {
  return render(
    <AuthContext.Provider
      value={{ user: null, isAuthenticated: false, isLoading: false, ...overrides }}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard" element={<p>Dashboard destination</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => window.history.replaceState(null, '', '/'));

describe('AuthCallbackPage', () => {
  it('does not claim confirmation when opened without a session', () => {
    renderCallback();
    expect(screen.queryByText('Email confirmed')).not.toBeInTheDocument();
    expect(screen.getByText(/could not verify a session/)).toBeInTheDocument();
  });

  it('waits for session initialization', () => {
    renderCallback('/auth/callback', { isLoading: true });
    expect(screen.getByText('Confirming your email...')).toBeInTheDocument();
  });

  it('redirects an authenticated callback to the dashboard', async () => {
    renderCallback('/auth/callback', {
      isAuthenticated: true,
      user: { id: 'alice', email: 'alice@example.com' },
    });
    expect(await screen.findByText('Dashboard destination')).toBeInTheDocument();
  });

  it('shows query errors even if a session already exists', () => {
    renderCallback('/auth/callback?error_description=Link%20expired', { isAuthenticated: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Link expired');
    expect(screen.queryByText('Dashboard destination')).not.toBeInTheDocument();
  });

  it('shows fragment errors', () => {
    window.history.replaceState(
      null,
      '',
      '/auth/callback#error=access_denied&error_description=Link%20expired',
    );
    renderCallback();
    expect(screen.getByRole('alert')).toHaveTextContent('Link expired');
  });

  it('handles errors without a description', () => {
    renderCallback('/auth/callback?error=access_denied');
    expect(screen.getByRole('alert')).toHaveTextContent('access_denied');
  });
});
