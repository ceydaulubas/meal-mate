import { FullPageLoader } from '@/components/FullPageLoader';
import { useAuth } from '@/features/auth/session/auth-context';
import { useDashboardData } from './use-dashboard-data';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
    >
      <p className="font-semibold">We could not load your kitchen.</p>
      <p className="mt-1">Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-red-700 px-3 py-2 font-medium text-white hover:bg-red-800"
      >
        Try again
      </button>
    </div>
  );
}

function DashboardContent({ userId, email }: { userId: string; email: string | null }) {
  const dashboardQuery = useDashboardData(userId);

  if (dashboardQuery.isPending) {
    return <FullPageLoader message="Loading your kitchen..." />;
  }

  if (dashboardQuery.isError) {
    return <DashboardError onRetry={() => void dashboardQuery.refetch()} />;
  }

  const { profile, spaces } = dashboardQuery.data;
  const personalSpace = spaces.find((space) => space.type === 'PERSONAL');

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Welcome, {profile.display_name}
        </h1>
        <p className="mt-2 text-slate-600">
          This is your personal corner of MealMate. Shared spaces and meal planning will build on
          it.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Your profile</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Display name</dt>
              <dd className="mt-1 text-slate-900">{profile.display_name}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Email</dt>
              <dd className="mt-1 text-slate-900">{email ?? 'Not available'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Member since</dt>
              <dd className="mt-1 text-slate-900">{formatDate(profile.created_at)}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Personal space</h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Personal
            </span>
          </div>
          {personalSpace ? (
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Name</dt>
                <dd className="mt-1 text-slate-900">{personalSpace.name}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Created</dt>
                <dd className="mt-1 text-slate-900">{formatDate(personalSpace.created_at)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Your role</dt>
                <dd className="mt-1 text-slate-900">Owner</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-5 text-sm text-amber-800">
              Your personal space is missing. Please contact support.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return <DashboardContent userId={user.id} email={user.email} />;
}
