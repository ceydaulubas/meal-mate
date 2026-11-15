import { Navigate, Outlet } from 'react-router';
import { FullPageLoader } from '@/components/FullPageLoader';
import { useAuth } from '../auth-context';

export function GuestOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageLoader message="Checking your session..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
