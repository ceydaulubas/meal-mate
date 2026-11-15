import type { Session } from '@supabase/supabase-js';
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
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      setSession(error ? null : data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
