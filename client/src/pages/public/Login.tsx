/**
 * Module purpose: Validates sign-in credentials, calls the authentication context, and redirects after successful login.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { isAdmin } from '../../lib/permissions';
import { Button, Input } from '../../components/ui';
import { AuthShell } from './AuthShell';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type Form = z.infer<typeof schema>;

/**
 * Validates sign-in credentials, calls the authentication context, and redirects after successful login.
 */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Form) => {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? (isAdmin(user.role) ? '/admin' : '/app'), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="See what your business owes and when."
      footer={
        <>
          New to SME Comply? <Link to="/register" className="link">Create an account</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <p className="rounded border border-signal-100 bg-signal-50 px-3 py-2 text-sm text-signal-700" role="alert">{error}</p>}
        <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="link">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
      <details className="mt-6 rounded border border-line bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium">Demo accounts</summary>
        <p className="mt-2 text-ink-500">After running the seed script:</p>
        <ul className="mt-1 space-y-0.5 text-ink-700">
          <li>owner@demo.smecomply.ng (Demo@12345)</li>
          <li>accountant@demo.smecomply.ng (Demo@12345)</li>
          <li>officer@demo.smecomply.ng (Demo@12345)</li>
          <li>superadmin@smecomply.ng (Admin@12345)</li>
        </ul>
      </details>
    </AuthShell>
  );
}
