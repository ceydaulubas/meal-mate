import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/FullPageLoader';
import { useAuth } from '../session/auth-context';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader message="Checking your session..." />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return <Outlet />;
}
