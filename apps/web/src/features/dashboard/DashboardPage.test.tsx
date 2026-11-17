import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '@/test/render';
import { AuthContext } from '@/features/auth/session/auth-context';
import { getDashboardData } from './api';
import { DashboardPage } from './DashboardPage';

vi.mock('./api', () => ({
  getDashboardData: vi.fn(),
}));

const mockedGetDashboardData = vi.mocked(getDashboardData);
const userId = '11111111-1111-4111-8111-111111111111';

describe('DashboardPage', () => {
  it('displays the profile and personal space', async () => {
    mockedGetDashboardData.mockResolvedValue({
      profile: {
        id: userId,
        display_name: 'Alice',
        avatar_url: null,
        created_at: '2026-01-10T10:00:00+00:00',
        updated_at: '2026-01-10T10:00:00+00:00',
      },
      spaces: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: "Alice's Space",
          type: 'PERSONAL',
          created_by: userId,
          created_at: '2026-01-10T10:00:00+00:00',
          updated_at: '2026-01-10T10:00:00+00:00',
        },
      ],
    });

    renderWithQueryClient(
      <AuthContext.Provider
        value={{
          user: { id: userId, email: 'alice@example.com' },
          isAuthenticated: true,
          isLoading: false,
        }}
      >
        <DashboardPage />
      </AuthContext.Provider>,
    );

    expect(await screen.findByText('Welcome, Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText("Alice's Space")).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });
});
