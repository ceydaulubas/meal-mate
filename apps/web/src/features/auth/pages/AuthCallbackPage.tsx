import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { FullPageLoader } from '@/components/FullPageLoader';
import { AuthCard } from '../components/AuthCard';
import { useAuth } from '../session/auth-context';

export function AuthCallbackPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const errorDescription =
    searchParams.get('error_description') ??
    hashParams.get('error_description') ??
    searchParams.get('error') ??
    hashParams.get('error');

  useEffect(() => {
    if (!errorDescription && !isLoading && isAuthenticated) {
      void navigate('/dashboard', { replace: true });
    }
  }, [errorDescription, isAuthenticated, isLoading, navigate]);

  if (errorDescription) {
    return (
      <AuthCard
        title="Confirmation failed"
        description="We could not confirm your email address. Try signing in again or request a new link."
        footer={
          <Link to="/login" className="font-medium text-emerald-700 hover:text-emerald-800">
            Back to sign in
          </Link>
        }
      >
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorDescription}
        </p>
      </AuthCard>
    );
  }

  if (isLoading || isAuthenticated) {
    return <FullPageLoader message="Confirming your email..." />;
  }

  return (
    <AuthCard
      title="Continue to sign in"
      description="If you followed a confirmation link, try signing in to continue. We could not verify a session in this tab."
      footer={
        <Link to="/login" className="font-medium text-emerald-700 hover:text-emerald-800">
          Continue to sign in
        </Link>
      }
    >
      <p className="text-sm text-slate-600">You can close this tab if you signed in elsewhere.</p>
    </AuthCard>
  );
}
