import type { AuthError } from '@supabase/supabase-js';
import type { SignInInput, SignUpInput } from '@meal-mate/contracts';
import { getSupabaseClient } from '@/lib/supabase/client';

export interface SignUpResult {
  requiresEmailConfirmation: boolean;
}

function throwAuthError(error: AuthError | null): void {
  if (error) {
    throw error;
  }
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  throwAuthError(error);

  return { requiresEmailConfirmation: data.session === null };
}

export async function signIn(input: SignInInput): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  throwAuthError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  throwAuthError(error);
}
