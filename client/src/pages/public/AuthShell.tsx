/**
 * Module purpose: Keeps the login, registration, and password-recovery screens consistent.
 */
import { ReactNode } from 'react';
import { Logo } from '../../components/layout/Logo';

/** Split layout: the form on one side, a strip of real deadlines on the other. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_28rem]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink-500">{footer}</div>}
        </div>
      </div>
      <aside className="hidden bg-ink-900 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-center" aria-hidden>
        <p className="text-sm text-white/60">This month, a typical Lagos limited company owes</p>
        <ul className="mt-6 space-y-5">
          {[
            ['7', 'Pension contributions', 'PenCom'],
            ['10', 'PAYE remittance', 'LIRS'],
            ['16', "Employees' compensation", 'NSITF'],
            ['21', 'VAT return', 'NRS'],
            ['21', 'Withholding tax', 'NRS'],
          ].map(([day, name, agency]) => (
            <li key={name} className="flex items-baseline gap-5 border-b border-white/10 pb-4">
              <span className="tabular w-10 text-right text-3xl font-extrabold text-ledger-500">{day}</span>
              <span>
                <span className="block font-semibold">{name}</span>
                <span className="text-sm text-white/55">{agency}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-white/45">Illustrative sample dates. Verify with each authority.</p>
      </aside>
    </div>
  );
}
