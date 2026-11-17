import type { Session } from '@supabase/supabase-js';
import { act, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient, renderWithQueryClient } from '@/test/render';
import { render } from '@testing-library/react';
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

function renderAuth() {
  return renderWithQueryClient(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

function emitSession(session: Session | null) {
  const callback = mockOnAuthStateChange.mock.lastCall?.[0] as (
    event: string,
    session: Session | null,
  ) => void;
  act(() => callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
}

const alice = { user: { id: 'user-1', email: 'alice@example.com' } } as Session;
const bob = { user: { id: 'user-2', email: 'bob@example.com' } } as Session;

describe('AuthProvider', () => {
  beforeEach(() => {
    mockGetSession.mockReset().mockResolvedValue({ data: { session: alice }, error: null });
    mockOnAuthStateChange.mockClear();
  });
  it('loads the current session and exposes the authenticated user', async () => {
    const { unmount } = renderWithQueryClient(
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
    renderWithQueryClient(
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

  it('finishes initialization when getSession rejects', async () => {
    mockGetSession.mockRejectedValue(new Error('offline'));
    renderAuth();
    expect(await screen.findByText('false:none')).toBeInTheDocument();
  });

  it('treats a returned session error as signed out', async () => {
    mockGetSession.mockResolvedValue({ data: { session: alice }, error: new Error('expired') });
    renderAuth();
    expect(await screen.findByText('false:none')).toBeInTheDocument();
  });

  it('clears retained data when initialization finds no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['dashboard', 'previous-user'], 'private profile');
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await screen.findByText('false:none');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores a stale initialization %s after an auth event',
    async (outcome) => {
      let resolve!: (value: unknown) => void;
      let reject!: (error: Error) => void;
      mockGetSession.mockReturnValue(
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
      );
      renderAuth();
      emitSession(bob);
      await act(async () => {
        if (outcome === 'resolve') resolve({ data: { session: alice }, error: null });
        else reject(new Error('late failure'));
      });
      expect(screen.getByText('true:bob@example.com')).toBeInTheDocument();
    },
  );

  it('clears queries and mutations on identity changes but retains them on token refresh', async () => {
    const { queryClient } = renderAuth();
    await screen.findByText('true:alice@example.com');
    queryClient.setQueryData(['dashboard', alice.user.id], 'private profile');
    queryClient.getMutationCache().build(queryClient, { mutationKey: ['private-write'] });
    emitSession(alice);
    expect(queryClient.getQueryData(['dashboard', alice.user.id])).toBe('private profile');
    emitSession(bob);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    queryClient.setQueryData(['dashboard', bob.user.id], 'another profile');
    emitSession(null);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(screen.getByText('false:none')).toBeInTheDocument();
  });

  it('ignores initialization completion after unmount', async () => {
    let resolve!: (value: unknown) => void;
    mockGetSession.mockReturnValue(
      new Promise((yes) => {
        resolve = yes;
      }),
    );
    const queryClient = createTestQueryClient();
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    unmount();
    queryClient.setQueryData(['retained'], 'value');
    await act(async () => resolve({ data: { session: alice }, error: null }));
    expect(queryClient.getQueryData(['retained'])).toBe('value');
  });
});
