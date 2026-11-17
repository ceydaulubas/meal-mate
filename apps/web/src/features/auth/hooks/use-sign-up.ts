import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { SignUpInput } from '@meal-mate/contracts';
import { signUp } from '../api/auth-api';

export function useSignUp() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: SignUpInput) => signUp(input),
    onSuccess: (result) => {
      if (!result.requiresEmailConfirmation) {
        void navigate('/dashboard', { replace: true });
      }
    },
  });
}
