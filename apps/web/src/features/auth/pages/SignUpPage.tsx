import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpInput } from '@meal-mate/contracts';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { AuthCard } from '../components/AuthCard';
import { AuthField } from '../components/AuthField';
import { getAuthErrorMessage } from '../get-auth-error-message';
import { useSignUp } from '../use-sign-up';

export function SignUpPage() {
  const signUpMutation = useSignUp();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    signUpMutation.mutate(values);
  });

  const needsEmailConfirmation =
    signUpMutation.isSuccess && signUpMutation.data.requiresEmailConfirmation;

  if (needsEmailConfirmation) {
    return (
      <AuthCard
        title="Check your inbox"
        description="Your account is ready. Confirm your email address before signing in."
        footer={
          <Link to="/login" className="font-medium text-emerald-700 hover:text-emerald-800">
            Back to sign in
          </Link>
        }
      >
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          We sent a confirmation link to{' '}
          <span className="font-semibold">{signUpMutation.variables.email}</span>.
        </p>
      </AuthCard>
    );
  }

  const errorMessage = signUpMutation.isError
    ? getAuthErrorMessage(signUpMutation.error)
    : undefined;

  return (
    <AuthCard
      title="Create your account"
      description="Start with your own space. Shared spaces and meal planning come next."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-emerald-700 hover:text-emerald-800">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorMessage}
          </p>
        ) : null}

        <AuthField
          id="display-name"
          label="Display name"
          autoComplete="name"
          registration={register('displayName')}
          error={errors.displayName?.message}
        />

        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          registration={register('email')}
          error={errors.email?.message}
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          registration={register('password')}
          error={errors.password?.message}
          hint="Use at least 8 characters."
        />

        <button
          type="submit"
          disabled={signUpMutation.isPending}
          className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
        >
          {signUpMutation.isPending ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
