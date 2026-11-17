import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { signOut } from '../api/auth-api';

export function useSignOut() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      void navigate('/login', { replace: true });
    },
  });
}
