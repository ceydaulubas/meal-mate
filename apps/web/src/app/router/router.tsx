import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/app/layouts/AppLayout';
import { HomePage } from '@/features/home/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
]);
