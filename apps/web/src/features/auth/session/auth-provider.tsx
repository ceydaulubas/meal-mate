import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { AuthContext, type AuthContextValue } from './auth-context';

function toAuthUser(session: Session | null): AuthContextValue['user'] {
  if (!session) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email ?? null,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let authEventReceived = false;
    let identity: string | null | undefined;
    const supabase = getSupabaseClient();

    function applySession(nextSession: Session | null) {
      if (!isMounted) {
        return;
      }
      const nextIdentity = nextSession?.user.id ?? null;
      if (identity !== nextIdentity) {
        // Clear before publishing the new identity, including changes from
        // another tab or session expiry. Token refreshes retain the cache.
        queryClient.clear();
        identity = nextIdentity;
      }
      setSession(nextSession);
      setIsLoading(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      applySession(nextSession);
    });

    void supabase.auth.getSession().then(
      ({ data, error }) => {
        if (!authEventReceived) {
          applySession(error ? null : data.session);
        }
      },
      () => {
        if (!authEventReceived) {
          applySession(null);
        }
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: toAuthUser(session),
      isAuthenticated: session !== null,
      isLoading,
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
