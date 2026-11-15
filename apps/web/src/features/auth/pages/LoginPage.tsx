import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInInput } from '@meal-mate/contracts';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { AuthCard } from '../components/AuthCard';
import { AuthField } from '../components/AuthField';
import { getAuthErrorMessage } from '../get-auth-error-message';
import { useSignIn } from '../use-sign-in';

export function LoginPage() {
  const signInMutation = useSignIn();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    signInMutation.mutate(values);
  });

  const errorMessage = signInMutation.isError
    ? getAuthErrorMessage(signInMutation.error)
    : undefined;

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to see your kitchen and personal space."
      footer={
        <>
          New to MealMate?{' '}
          <Link to="/signup" className="font-medium text-emerald-700 hover:text-emerald-800">
            Create an account
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
          autoComplete="current-password"
          registration={register('password')}
          error={errors.password?.message}
        />

        <button
          type="submit"
          disabled={signInMutation.isPending}
          className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
        >
          {signInMutation.isPending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}
