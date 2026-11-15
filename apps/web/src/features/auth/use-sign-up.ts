import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { SignUpInput } from '@meal-mate/contracts';
import { signUp } from './api';

export function useSignUp() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SignUpInput) => signUp(input),
    onSuccess: (result) => {
      if (!result.requiresEmailConfirmation) {
        queryClient.clear();
        void navigate('/dashboard', { replace: true });
      }
    },
  });
}
