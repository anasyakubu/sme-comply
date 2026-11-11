/**
 * Module purpose: Shared create/edit business form. Zod verifies input, and helper functions translate between API business records and editable form values.
 */
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useLookups } from '../../hooks/useLookups';
import type { Business } from '../../types';
import { Button, Checkbox, Input, Select, Textarea } from '../ui';

const optional = z.string().trim().optional();

export const businessSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter the business name'),
  legalName: optional,
  registrationNumber: optional,
  taxIdentificationNumber: optional,
  businessType: z.string().min(1, 'Choose a business type'),
  industry: z.string().min(1, 'Choose an industry'),
  state: z.string().min(1, 'Choose a state'),
  city: optional,
  address: optional,
  phone: optional,
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address')]).optional(),
  website: z.union([z.literal(''), z.string().trim().url('Enter a full URL starting with https://')]).optional(),
  dateOfIncorporation: z
    .string()
    .optional()
    .refine((v) => !v || new Date(v) <= new Date(), 'Date cannot be in the future'),
  employeeCount: z.coerce.number({ invalid_type_error: 'Enter a number' }).int('Enter a whole number').min(0),
  annualTurnover: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0),
  flags: z.object({
    cacRegistered: z.boolean(),
    taxRegistered: z.boolean(),
    vatRegistered: z.boolean(),
    pensionRegistered: z.boolean(),
    regulatedProducts: z.boolean(),
    importsExports: z.boolean(),
  }),
});
export type BusinessFormValues = z.infer<typeof businessSchema>;

/**
 * Converts a saved business to the values expected by the editable form.
 */
export function toFormValues(b?: Business): BusinessFormValues {
  return {
    businessName: b?.businessName ?? '',
    legalName: b?.legalName ?? '',
    registrationNumber: b?.registrationNumber ?? '',
    taxIdentificationNumber: b?.taxIdentificationNumber ?? '',
    businessType: b?.businessType ?? '',
    industry: b?.industry ?? '',
    state: b?.state ?? '',
    city: b?.city ?? '',
    address: b?.address ?? '',
    phone: b?.phone ?? '',
    email: b?.email ?? '',
    website: b?.website ?? '',
    dateOfIncorporation: b?.dateOfIncorporation ? format(new Date(b.dateOfIncorporation), 'yyyy-MM-dd') : '',
    employeeCount: b?.employeeCount ?? 0,
    annualTurnover: b?.annualTurnover ?? 0,
    flags: {
      cacRegistered: b?.flags?.cacRegistered ?? true,
      taxRegistered: b?.flags?.taxRegistered ?? false,
      vatRegistered: b?.flags?.vatRegistered ?? false,
      pensionRegistered: b?.flags?.pensionRegistered ?? false,
      regulatedProducts: b?.flags?.regulatedProducts ?? false,
      importsExports: b?.flags?.importsExports ?? false,
    },
  };
}

/** Converts empty strings to undefined so optional fields aren't sent blank. */
export function toPayload(v: BusinessFormValues) {
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === '' ? undefined : val]));
}

interface Props {
  initial?: Business;
  submitLabel: string;
  onSubmit: (values: BusinessFormValues) => Promise<void>;
  onCancel?: () => void;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line py-6 last:border-b-0 md:grid-cols-[14rem_1fr] md:gap-8">
      <div>
        <h2 className="font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Displays the shared business form and reports only validated values to its parent.
 */
export function BusinessForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const options = useLookups();
  const { register, handleSubmit, formState } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: toFormValues(initial),
  });
  const e = formState.errors;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="panel px-5">
      <Section title="About the business" description="Type, state and industry decide most of what applies.">
        <Input label="Business name" required wrapperClassName="sm:col-span-2" error={e.businessName?.message} {...register('businessName')} />
        <Input label="Registered legal name" hint="As it appears on your CAC certificate" wrapperClassName="sm:col-span-2" {...register('legalName')} />
        <Select label="Business type" required placeholder="Choose…" options={options?.businessTypes ?? []} error={e.businessType?.message} {...register('businessType')} />
        <Select label="Industry" required placeholder="Choose…" options={options?.industries.length ? options.industries : ['Other']} error={e.industry?.message} {...register('industry')} />
        <Select label="State" required placeholder="Choose…" options={options?.states ?? []} error={e.state?.message} {...register('state')} />
        <Input label="City or LGA" {...register('city')} />
        <Textarea label="Address" wrapperClassName="sm:col-span-2" rows={2} {...register('address')} />
      </Section>

      <Section title="Registration" description="Used for annual and one-time obligations.">
        <Input label="RC or BN number" {...register('registrationNumber')} />
        <Input label="Tax Identification Number (TIN)" {...register('taxIdentificationNumber')} />
        <Input label="Date of incorporation" type="date" error={e.dateOfIncorporation?.message} {...register('dateOfIncorporation')} />
      </Section>

      <Section title="Size" description="Staff numbers drive PAYE, pension and other employer obligations.">
        <Input label="Number of employees" type="number" min={0} error={e.employeeCount?.message} {...register('employeeCount')} />
        <Input label="Annual turnover (₦)" type="number" min={0} error={e.annualTurnover?.message} {...register('annualTurnover')} />
      </Section>

      <Section title="What you're registered for" description="Tick everything that's true today. You can change this later.">
        <Checkbox label="Registered with CAC" {...register('flags.cacRegistered')} />
        <Checkbox label="Has a Tax ID (TIN)" {...register('flags.taxRegistered')} />
        <Checkbox label="Registered for VAT" description="You charge VAT on sales" {...register('flags.vatRegistered')} />
        <Checkbox label="Registered for pension" description="Employees have PFA accounts" {...register('flags.pensionRegistered')} />
        <Checkbox label="Makes or sells regulated products" description="Food, drugs, cosmetics, chemicals" {...register('flags.regulatedProducts')} />
        <Checkbox label="Imports or exports goods" {...register('flags.importsExports')} />
      </Section>

      <Section title="Contact">
        <Input label="Phone" type="tel" {...register('phone')} />
        <Input label="Email" type="email" error={e.email?.message} {...register('email')} />
        <Input label="Website" type="url" placeholder="https://" wrapperClassName="sm:col-span-2" error={e.website?.message} {...register('website')} />
      </Section>

      <div className="flex justify-end gap-2 py-5">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={formState.isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
