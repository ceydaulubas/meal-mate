import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from '../session/auth-context';
import { ProtectedRoute } from './ProtectedRoute';

function renderProtectedRoute(auth: AuthContextValue) {
  const router = createMemoryRouter(
    [
      {
        element: <ProtectedRoute />,
        children: [{ path: '/dashboard', element: <p>Protected dashboard</p> }],
      },
      { path: '/login', element: <p>Login page</p> },
    ],
    { initialEntries: ['/dashboard'] },
  );

  return render(
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state while the session is checked', () => {
    renderProtectedRoute({ user: null, isAuthenticated: false, isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session...');
  });

  it('redirects unauthenticated users to the login page', async () => {
    renderProtectedRoute({ user: null, isAuthenticated: false, isLoading: false });

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('renders protected content for authenticated users', async () => {
    renderProtectedRoute({
      user: { id: 'user-1', email: 'alice@example.com' },
      isAuthenticated: true,
      isLoading: false,
    });

    expect(await screen.findByText('Protected dashboard')).toBeInTheDocument();
  });
});
