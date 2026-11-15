import { useQuery } from '@tanstack/react-query';
import { getDashboardData } from './api';

export function useDashboardData(userId: string) {
  return useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => getDashboardData(userId),
  });
}
