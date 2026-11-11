/**
 * Module purpose: Validates user registration (including password confirmation), creates an account, and enters the authenticated workspace.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../lib/api';
import { Button, Input } from '../../components/ui';
import { AuthShell } from './AuthShell';

export const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name'),
    lastName: z.string().trim().min(1, 'Enter your last name'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().max(20).optional(),
    password: passwordRule,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type Form = z.infer<typeof schema>;

/**
 * Validates user registration (including password confirmation), creates an account, and enters the authenticated workspace.
 */
export default function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invited = params.has('invite');
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ confirm: _confirm, ...values }: Form) => {
    setError(null);
    try {
      await signUp(values);
      toast.success('Account created. Check your email to confirm your address.');
      navigate(invited ? '/app' : '/app/businesses/new', { replace: true });
    } catch (err) {
      const fields = fieldErrors(err);
      Object.entries(fields).forEach(([k, m]) => setFieldError(k as keyof Form, { message: m }));
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle={invited ? 'Use the email address your invitation was sent to and you will join that business automatically.' : 'Free to start. Add your first business right after.'}
      footer={
        <>
          Already have an account? <Link to="/login" className="link">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <p className="rounded border border-signal-100 bg-signal-50 px-3 py-2 text-sm text-signal-700" role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" autoComplete="given-name" error={formState.errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" autoComplete="family-name" error={formState.errors.lastName?.message} {...register('lastName')} />
        </div>
        <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <Input label="Phone" type="tel" autoComplete="tel" hint="Optional" error={formState.errors.phone?.message} {...register('phone')} />
        <Input label="Password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number" error={formState.errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
        <p className="text-xs text-ink-500">
          SME Comply helps you track obligations. It is not legal or tax advice and does not file on your behalf.
        </p>
      </form>
    </AuthShell>
  );
}
