import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import type { SignInInput } from '@meal-mate/contracts';
import { signIn } from './api';

interface LoginLocationState {
  from?: string;
}

function getRedirectPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return '/dashboard';
  }

  const { from } = state as LoginLocationState;

  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
    return from;
  }

  return '/dashboard';
}

export function useSignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SignInInput) => signIn(input),
    onSuccess: () => {
      queryClient.clear();
      void navigate(getRedirectPath(location.state), { replace: true });
    },
  });
}
