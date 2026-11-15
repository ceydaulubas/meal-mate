import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/app/layouts/AppLayout';
import { GuestOnlyRoute } from '@/features/auth/components/GuestOnlyRoute';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { AuthCallbackPage } from '@/features/auth/pages/AuthCallbackPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignUpPage } from '@/features/auth/pages/SignUpPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { HomePage } from '@/features/home/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <GuestOnlyRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignUpPage /> },
        ],
      },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: 'dashboard', element: <DashboardPage /> }],
      },
    ],
  },
]);
