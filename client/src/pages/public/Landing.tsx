/**
 * Module purpose: Public overview of the SME compliance product and links to account creation or sign-in.
 */
import { Link } from 'react-router-dom';
import { Logo } from '../../components/layout/Logo';
import { ButtonLink } from '../../components/ui';

const SAMPLE = [
  { days: '3', caption: 'days left', name: 'Pension contributions', agency: 'PenCom', period: 'August 2026', tone: 'text-due-600' },
  { days: '6', caption: 'days left', name: 'PAYE remittance', agency: 'Lagos IRS', period: 'August 2026', tone: 'text-due-600' },
  { days: '17', caption: 'days left', name: 'VAT return', agency: 'NRS', period: 'August 2026', tone: 'text-ink-900' },
  { days: '17', caption: 'days left', name: 'Withholding tax', agency: 'NRS', period: 'August 2026', tone: 'text-ink-900' },
  { days: '✓', caption: 'done', name: 'CAC annual returns', agency: 'CAC', period: '2026', tone: 'text-ink-300' },
];

const AGENCIES = [
  ['CAC', 'Annual returns for companies and business names'],
  ['NRS (formerly FIRS)', 'VAT, withholding tax, company income tax, TIN'],
  ['State revenue services', 'PAYE, annual employer returns, personal income tax'],
  ['PenCom', 'Monthly pension remittances and compliance certificates'],
  ['NSITF', "Employees' Compensation Scheme contributions"],
  ['ITF', 'Annual training fund contributions'],
  ['NAFDAC and SON', 'Product registrations and standards certification'],
];

/**
 * Public overview of the SME compliance product and links to account creation or sign-in.
 */
export default function Landing() {
  return (
    <div className="bg-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link to="/login" className="rounded px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-900/5">
            Sign in
          </Link>
          <ButtonLink to="/register" size="sm">
            Create free account
          </ButtonLink>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
              Every filing your business owes, with the date it's due.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-700">
              Tell SME Comply what kind of business you run and where. It works out which CAC, tax, pension and state
              obligations apply, lays them out by deadline, and reminds your team before each one falls due.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/register" size="lg">
                Create free account
              </ButtonLink>
              <ButtonLink to="/login" size="lg" variant="secondary">
                Sign in
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-ink-500">Made for Nigerian small and medium businesses and the accountants who serve them.</p>
          </div>

          <figure className="panel shadow-raise" aria-label="Example of an obligations list">
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <div>
                <p className="font-bold">Adaeze Foods Ltd</p>
                <p className="text-sm text-ink-500">Limited company in Lagos, 12 staff</p>
              </div>
              <p className="text-sm text-ink-500">September 2026</p>
            </div>
            <ul className="divide-y divide-line">
              {SAMPLE.map((s) => (
                <li key={s.name} className="flex items-center gap-5 px-5 py-3.5">
                  <div className="flex w-14 flex-col items-end">
                    <span className={`tabular text-2xl font-extrabold leading-none ${s.tone}`}>{s.days}</span>
                    <span className="mt-1 text-[0.7rem] text-ink-500">{s.caption}</span>
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold ${s.caption === 'done' ? 'text-ink-400' : ''}`}>{s.name}</p>
                    <p className="text-sm text-ink-500">
                      {s.agency}, {s.period}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <figcaption className="border-t border-line px-5 py-3 text-xs text-ink-500">Illustration with sample dates.</figcaption>
          </figure>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-bold">How it works</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {[
                ['Describe your business', 'Business type, state, industry, staff count and what you are registered for. It takes about two minutes.'],
                ['See what applies', 'A rules engine matches your profile to regulatory requirements and generates each filing with its due date for the next twelve months.'],
                ['Stay ahead of deadlines', 'Get reminders by email and in the app, record each filing with its reference number, and keep receipts and certificates in one place.'],
              ].map(([title, body], i) => (
                <li key={title} className="border-t-2 border-ink-900 pt-4">
                  <p className="tabular text-sm font-bold text-ledger-700">Step {i + 1}</p>
                  <h3 className="mt-1 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-ink-700">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">What it keeps track of</h2>
            <p className="mt-3 max-w-md text-ink-700">
              Requirements are stored as data, not hard-coded, so administrators can update deadlines and rules as regulations change.
            </p>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {AGENCIES.map(([name, what]) => (
                <div key={name} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
                  <dt className="font-semibold">{name}</dt>
                  <dd className="text-ink-700">{what}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Share the work with your team</h2>
            <p className="mt-3 max-w-md text-ink-700">Invite the people who handle your filings. Each person sees the businesses they belong to and nothing else.</p>
            <dl className="mt-6 space-y-5">
              <div>
                <dt className="font-semibold">Business owner</dt>
                <dd className="text-ink-700">Manages the business profile, team and reminder settings.</dd>
              </div>
              <div>
                <dt className="font-semibold">Accountant</dt>
                <dd className="text-ink-700">Updates obligations, records filings and uploads receipts.</dd>
              </div>
              <div>
                <dt className="font-semibold">Compliance officer</dt>
                <dd className="text-ink-700">Tracks every deadline, manages reminders and decides what doesn't apply.</dd>
              </div>
            </dl>
            <div className="mt-8 rounded-lg border border-due-100 bg-due-50 p-4 text-sm text-ink-700">
              <p className="font-semibold text-ink-900">What SME Comply is not</p>
              <p className="mt-1">
                It does not submit filings to government agencies and is not legal or tax advice. The included regulatory data is sample
                data; confirm current rules with each authority or a professional adviser.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-ink-900">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-14 md:flex-row md:items-center md:justify-between">
            <h2 className="max-w-xl text-2xl font-bold text-white">Add your business and see this year's deadlines in two minutes.</h2>
            <ButtonLink to="/register" size="lg">
              Create free account
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-ink-500 sm:flex-row sm:justify-between">
        <span>SME Comply, a final-year project.</span>
        <span>Regulatory data shown is illustrative. Verify with the relevant authority.</span>
      </footer>
    </div>
  );
}
