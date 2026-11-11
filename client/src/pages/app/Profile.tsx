/**
 * Module purpose: Edits the signed-in user profile and synchronizes updated identity data with authentication context.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, patch, post } from '../../lib/api';
import { fmtDate, ROLE_LABEL } from '../../lib/format';
import type { User } from '../../types';
import { Badge, Button, Input, PageHeader } from '../../components/ui';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name'),
  lastName: z.string().trim().min(1, 'Enter your last name'),
  phone: z.string().trim().max(20).optional(),
});

/**
 * Edits the signed-in user profile and synchronizes updated identity data with authentication context.
 */
export default function Profile() {
  const { user, setUser } = useAuth();
  const [sending, setSending] = useState(false);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: user?.firstName, lastName: user?.lastName, phone: user?.phone ?? '' },
  });

  const onSubmit = async (v: z.infer<typeof schema>) => {
    try {
      const res = await patch<User>('/users/me', v);
      setUser(res.data);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const resend = async () => {
    setSending(true);
    try {
      await post('/auth/resend-verification');
      toast.success('Confirmation email sent');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" description="How your name appears to your team and in reminder emails." />
      <section className="panel p-5">
        <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line pb-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ledger-600 text-lg font-bold text-white">
            {user.firstName[0]}
            {user.lastName[0]}
          </span>
          <div className="flex-1">
            <p className="font-bold">{user.email}</p>
            <p className="text-sm text-ink-500">
              {ROLE_LABEL[user.role]}, member since {fmtDate(user.createdAt)}
            </p>
          </div>
          {user.emailVerified ? (
            <Badge tone="green">Email confirmed</Badge>
          ) : (
            <Button size="sm" variant="secondary" loading={sending} onClick={resend}>
              Resend confirmation email
            </Button>
          )}
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Input label="First name" error={formState.errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" error={formState.errors.lastName?.message} {...register('lastName')} />
          <Input label="Phone" type="tel" {...register('phone')} />
          <div className="sm:col-span-2">
            <Button type="submit" loading={formState.isSubmitting}>
              Save profile
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
