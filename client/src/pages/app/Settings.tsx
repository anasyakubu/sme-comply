/**
 * Module purpose: Handles account settings such as password changes with client-side form validation.
 */
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useBusiness } from '../../context/BusinessContext';
import { errorMessage, fieldErrors, post } from '../../lib/api';
import { Button, Input, PageHeader } from '../../components/ui';
import { passwordRule } from '../public/Register';

const schema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordRule, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type Form = z.infer<typeof schema>;

/**
 * Handles account settings such as password changes with client-side form validation.
 */
export default function Settings() {
  const { current } = useBusiness();
  const { register, handleSubmit, formState, reset, setError } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ currentPassword, newPassword }: Form) => {
    try {
      await post('/users/me/password', { currentPassword, newPassword });
      toast.success('Password changed');
      reset();
    } catch (err) {
      const f = fieldErrors(err);
      if (f.currentPassword) setError('currentPassword', { message: f.currentPassword });
      else toast.error(errorMessage(err));
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" />

      <section className="panel p-5">
        <h2 className="font-bold">Change password</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
          <Input label="Current password" type="password" autoComplete="current-password" error={formState.errors.currentPassword?.message} {...register('currentPassword')} />
          <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number" error={formState.errors.newPassword?.message} {...register('newPassword')} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register('confirm')} />
          <Button type="submit" loading={formState.isSubmitting}>
            Change password
          </Button>
        </form>
      </section>

      <section className="panel p-5">
        <h2 className="font-bold">Reminders</h2>
        <p className="mt-1 text-sm text-ink-700">
          Reminder timing is set per business, so each team gets the schedule that suits it.
        </p>
        {current && (
          <Link to={`/app/businesses/${current._id}`} className="link mt-3 inline-block text-sm">
            Reminder settings for {current.businessName}
          </Link>
        )}
      </section>

      <section className="panel p-5 text-sm text-ink-700">
        <h2 className="font-bold text-ink-900">About the data</h2>
        <p className="mt-2">
          SME Comply tracks deadlines and keeps records. It does not submit filings to any government agency and is not legal or tax
          advice. Regulatory requirements in this installation include sample data; confirm current rules with the relevant authority
          or your adviser.
        </p>
      </section>
    </div>
  );
}
