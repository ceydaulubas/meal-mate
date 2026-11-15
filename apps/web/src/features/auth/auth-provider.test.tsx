import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth-provider';
import { useAuth } from './auth-context';

const { mockGetSession, mockOnAuthStateChange, mockUnsubscribe } = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  const session = {
    user: { id: 'user-1', email: 'alice@example.com' },
  };

  return {
    mockGetSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    mockOnAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe } },
    }),
    mockUnsubscribe: unsubscribe,
  };
});

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

function AuthProbe() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return <p>{isLoading ? 'loading' : `${String(isAuthenticated)}:${user?.email ?? 'none'}`}</p>;
}

describe('AuthProvider', () => {
  it('loads the current session and exposes the authenticated user', async () => {
    const { unmount } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('true:alice@example.com')).toBeInTheDocument();

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('reacts to authentication state changes', async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('true:alice@example.com')).toBeInTheDocument();

    const authStateCallback = mockOnAuthStateChange.mock.calls[0]?.[0] as
      ((event: string, session: null) => void) | undefined;

    act(() => {
      authStateCallback?.('SIGNED_OUT', null);
    });

    expect(screen.getByText('false:none')).toBeInTheDocument();
  });
});
