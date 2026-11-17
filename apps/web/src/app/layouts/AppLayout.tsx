import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '@/features/auth/session/auth-context';
import { getAuthErrorMessage } from '@/features/auth/utils/get-auth-error-message';
import { useSignOut } from '@/features/auth/hooks/use-sign-out';
import { useUiStore } from '@/stores/ui-store';

interface NavigationItem {
  label: string;
  to: string;
}

const publicNavigation: NavigationItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Log in', to: '/login' },
  { label: 'Sign up', to: '/signup' },
];

const privateNavigation: NavigationItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Dashboard', to: '/dashboard' },
];

function getNavLinkClassName({ isActive }: { isActive: boolean }) {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-emerald-50 text-emerald-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');
}

export function AppLayout() {
  const { isAuthenticated } = useAuth();
  const signOutMutation = useSignOut();
  const isNavigationOpen = useUiStore((state) => state.isNavigationOpen);
  const setNavigationOpen = useUiStore((state) => state.setNavigationOpen);
  const toggleNavigation = useUiStore((state) => state.toggleNavigation);
  const navigationItems = isAuthenticated ? privateNavigation : publicNavigation;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-emerald-700"
            onClick={() => setNavigationOpen(false)}
          >
            MealMate
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 sm:flex">
            {navigationItems.map((item) => (
              <NavLink key={item.to} to={item.to} end className={getNavLinkClassName}>
                {item.label}
              </NavLink>
            ))}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => signOutMutation.mutate()}
                disabled={signOutMutation.isPending}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {signOutMutation.isPending ? 'Logging out...' : 'Log out'}
              </button>
            ) : null}
          </nav>

          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 sm:hidden"
            aria-expanded={isNavigationOpen}
            aria-controls="mobile-navigation"
            onClick={toggleNavigation}
          >
            {isNavigationOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {signOutMutation.isError ? (
          <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800 sm:px-6">
            <p role="alert">Could not log out: {getAuthErrorMessage(signOutMutation.error)}</p>
          </div>
        ) : null}

        {isNavigationOpen ? (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="border-t border-slate-200 bg-white px-4 py-3 sm:hidden"
          >
            <div className="flex flex-col gap-1">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={getNavLinkClassName}
                  onClick={() => setNavigationOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => signOutMutation.mutate()}
                  disabled={signOutMutation.isPending}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {signOutMutation.isPending ? 'Logging out...' : 'Log out'}
                </button>
              ) : null}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-6">
        <div className="mx-auto w-full max-w-5xl px-4 text-sm text-slate-500 sm:px-6">
          Individual discovery first. Shared spaces and meal planning next.
        </div>
      </footer>
    </div>
  );
}
