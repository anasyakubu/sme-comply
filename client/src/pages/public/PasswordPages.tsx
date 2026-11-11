/**
 * Module purpose: Provides account recovery, email verification, and not-found screens using the authentication API.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { errorMessage, post } from '../../lib/api';
import { Button, ButtonLink, Input, Spinner } from '../../components/ui';
import { AuthShell } from './AuthShell';
import { passwordRule } from './Register';

/**
 * Provides account recovery, email verification, and not-found screens using the authentication API.
 */
export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().trim().email('Enter a valid email address') })),
  });
  const onSubmit = async ({ email }: { email: string }) => {
    try {
      await post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one." footer={<Link to="/login" className="link">Back to sign in</Link>}>
      {sent ? (
        <p className="rounded border border-ledger-100 bg-ledger-50 px-3 py-3 text-sm text-ledger-800" role="status">
          If an account exists for that email, a reset link is on its way. The link expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

const resetSchema = z
  .object({ password: passwordRule, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

/**
 * Provides account recovery, email verification, and not-found screens using the authentication API.
 */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  const onSubmit = async ({ password }: { password: string }) => {
    try {
      await post('/auth/reset-password', { token, password });
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  if (!token) {
    return (
      <AuthShell title="This link is incomplete" subtitle="Open the link from your email again, or request a new one.">
        <ButtonLink to="/forgot-password">Request a new link</ButtonLink>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="New password" type="password" autoComplete="new-password" error={formState.errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

/**
 * Provides account recovery, email verification, and not-found screens using the authentication API.
 */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'done' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState('This confirmation link is incomplete.');
  useEffect(() => {
    if (!token) return;
    post('/auth/verify-email', { token })
      .then(() => setState('done'))
      .catch((err) => {
        setMessage(errorMessage(err));
        setState('error');
      });
  }, [token]);
  return (
    <AuthShell title={state === 'done' ? 'Email confirmed' : state === 'error' ? 'We could not confirm your email' : 'Confirming your email'}>
      {state === 'loading' && <Spinner label="Confirming" />}
      {state === 'done' && (
        <>
          <p className="text-sm text-ink-700">Reminders will now reach your inbox.</p>
          <ButtonLink to="/app" className="mt-4">Go to dashboard</ButtonLink>
        </>
      )}
      {state === 'error' && (
        <>
          <p className="text-sm text-ink-700">{message} You can request a new link from your profile page.</p>
          <ButtonLink to="/app/profile" variant="secondary" className="mt-4">Go to profile</ButtonLink>
        </>
      )}
    </AuthShell>
  );
}

/**
 * Provides account recovery, email verification, and not-found screens using the authentication API.
 */
export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="tabular text-6xl font-extrabold text-ink-300">404</p>
      <h1 className="mt-3 text-xl font-bold">This page doesn't exist</h1>
      <p className="mt-1 text-sm text-ink-500">Check the address, or head back to your dashboard.</p>
      <ButtonLink to="/app" className="mt-5">Go to dashboard</ButtonLink>
    </div>
  );
}
