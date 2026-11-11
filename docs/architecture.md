# Architecture

## Overview

SME Comply is two applications that talk over a JSON REST API:

- **`server/`** is an Express + TypeScript API backed by MongoDB (Mongoose). It owns all business rules, runs the scheduled jobs and sends email.
- **`client/`** is a React single-page app built with Vite. It holds no business rules beyond mirroring permissions for display; the server is always the authority.

```
Browser (React SPA)
   │  HTTPS, JSON, Bearer access token (memory) + httpOnly refresh cookie
   ▼
Express app ── helmet, CORS allow-list, rate limit, cookie parser, operator sanitising, morgan
   │
   ├─ routes → middleware (authenticate, requireBusinessPermission, validate[Zod], upload)
   │           → controllers (HTTP only) → services (business logic) → repositories → Mongoose models
   │
   ├─ engine/  pure functions, no I/O: periods, dueDate, applicability, status, reminders, planner
   │
   ├─ jobs/    node-cron (Africa/Lagos): daily generate → refresh statuses → remind; hourly status refresh
   │
   └─ integrations: Nodemailer (console fallback), Cloudinary (local-disk fallback)
```

## Server layers

| Layer | Responsibility |
|---|---|
| `routes/` | URL shape, middleware order, and which permission each route needs |
| `middleware/` | Authentication, business-scoped access, Zod validation, uploads with signature checks, error mapping |
| `controllers/` | Read the request, call a service, and send the `{ success, message, data, meta }` envelope |
| `services/` | Business logic, audit logging, notifications and task generation |
| `repositories/` | Thin data-access wrappers (paging, sorting allow-lists, bulk writes) |
| `models/` | Mongoose schemas and indexes (see [database.md](database.md)) |
| `engine/` | Pure, unit-tested rules engines, independent of Express and MongoDB |

## The rules engines

Everything that decides *what a business owes and when* lives in `server/src/engine/`. These are pure functions, so they are fully unit-tested without a database.

1. **Periods** (`periods.ts`) turn a frequency into concrete periods with stable keys: `2026-03` (monthly), `2026-Q1`, `2026-H2`, `2026` (annual), `2026-C2` (custom interval), `ONCE` (one-time).
2. **Due dates** (`dueDate.ts`) apply a requirement's `dueRule` to a period. Handlers are registered in a table: `DAY_OF_MONTH`, `LAST_DAY_OF_MONTH`, `FIXED_DATE`, `DAYS_AFTER_PERIOD_END`, `MONTHS_AFTER_PERIOD_END`, `ANNIVERSARY`, `DAYS_AFTER_ANCHOR`. `registerDueRule()` adds new types (for example, a public-holiday shift) without touching existing code. All dates are UTC date-only values, and day numbers clamp to short months (31 → 28/29 February).
3. **Applicability** (`applicability.ts`) evaluates nested `ALL`/`ANY` groups of conditions over business facts: `businessType`, `state`, `industry`, `employeeCount`, `annualTurnover`, `businessStatus` and the `flags.*` booleans. Operators are `EQ`, `NEQ`, `IN`, `NOT_IN`, `GT`, `GTE`, `LT`, `LTE`, `EXISTS`, `IS_TRUE`, `IS_FALSE` and `CONTAINS`. String comparisons ignore case. The evaluator returns reasons, which power the admin preview.
4. **Status and priority** (`status.ts`):
   - `UPCOMING`: more than 14 days away.
   - `PENDING`: due within 14 days.
   - `OVERDUE`: past due.
   - `IN_PROGRESS`: set by a user; survives until the due date passes.
   - `COMPLETED` and `NOT_APPLICABLE`: terminal; never changed automatically.
   - Priority (`LOW` to `CRITICAL`) follows urgency.
5. **Reminder keys** (`reminders.ts`) work out which reminder window a task is in (`BEFORE_30`, `BEFORE_7`, `DUE_TODAY`, `OVERDUE_7`, …). If the job misses a day, it sends only the nearest crossed window, not every missed one.
6. **Planner** (`planner.ts`) combines the above to list the tasks that should exist for one business within a date window.

## Task lifecycle

```
Business created/updated ─┐
Requirement created/edited ├─► taskGeneration.generateForBusiness()
Daily job                 ─┘       1. planTasks() for the window [today − lookback, today + TASK_HORIZON_MONTHS]
                                    2. bulk upsert with $setOnInsert on (businessId, requirementId, period)
                                       → existing tasks and user changes are never overwritten
                                    3. open tasks for requirements that no longer apply → NOT_APPLICABLE
                                    4. previously auto-closed tasks that apply again → reopened
```

The unique index `{ businessId, requirementId, period }` guarantees no duplicates, even if two generations run at once.

Users move tasks through the rest of the lifecycle:
- Start work: `IN_PROGRESS`.
- Record a filing, optionally marking the task complete: `COMPLETED`.
- Mark not applicable: `NOT_APPLICABLE` (owner or compliance officer only).
- Reopen.

## Reminders and notifications

The daily job (`REMINDER_CRON`, default `0 7 * * *` Africa/Lagos) does the following:

1. Generates tasks for all active businesses.
2. Refreshes statuses and priorities.
3. For every open task and every active member of its business, computes the reminder key using that business's `ReminderSetting`.
4. Creates an in-app notification and sends an email if they are enabled.

A unique index on `{ userId, relatedTaskId, reminderKey }` makes each reminder idempotent: re-running the job never sends the same reminder twice. The job has a re-entrancy guard. Setting `ENABLE_JOBS=false` disables jobs on secondary instances.

## Authentication and authorisation

- **Tokens:**
  - Access token: JWT, 15 minutes, sent as a Bearer header and kept only in memory on the client.
  - Refresh token: random, stored hashed, sent as an httpOnly cookie scoped to `/api/v1/auth`, and rotated on every use.
  - Reuse detection: reusing an already-rotated refresh token revokes the whole token family.
- **Platform roles** (on `User.role`): `ADMIN` and `SUPER_ADMIN` reach `/admin`. Ordinary users carry the role they signed up with, but their power comes from memberships.
- **Business roles** (on `BusinessMember.role`):

  | Permission | Owner | Accountant | Compliance officer |
  |---|:-:|:-:|:-:|
  | View business, tasks, reports | ✓ | ✓ | ✓ |
  | Edit business profile | ✓ | | |
  | Invite and manage members | ✓ | | |
  | Update tasks, record filings, upload documents | ✓ | ✓ | ✓ |
  | Mark tasks not applicable | ✓ | | ✓ |
  | Delete documents | ✓ | | ✓ |
  | Manage reminder settings | ✓ | | ✓ |

  Admins can view any business read-only; super admins have full access.

- **Hiding other tenants:** `requireBusinessPermission` resolves access for every business-scoped request. Resources outside the user's businesses return **404**, not 403, so their existence isn't revealed.

## Security controls

- **HTTP hardening:** Helmet headers, a strict CORS allow-list with credentials, and rate limits (general API, and a tighter limit on auth routes).
- **Input handling:** Zod validation of body, params and query on every route; keys starting with `$` or containing `.` are stripped to prevent Mongo operator injection; sort fields are allow-listed; search terms are regex-escaped.
- **Passwords and tokens:** bcrypt with 12 rounds. Reset and verification tokens are single-use and stored hashed.
- **Uploads:** memory storage, a size limit, an extension and MIME allow-list, and a check that the file's first bytes match its claimed type. Local storage guards against path traversal.
- **CSV exports** neutralise formula injection.
- **Production start-up** refuses the default development secrets.
- **Audit log** records sign-ins, business and member changes, regulatory data changes, filings, uploads, deletions and admin actions. Audit writes never break a request.

## Frontend

- **Routing:** `App.tsx` defines three route groups:
  - Public: landing and auth pages.
  - `/app/*`: behind `ProtectedRoute`, inside `BusinessProvider` and `AppLayout`.
  - `/admin/*`: behind `AdminRoute`, inside `AdminLayout`.
  App and admin pages are lazy-loaded.
- **State:**
  - `AuthContext` restores the session on load via `/auth/refresh`.
  - `BusinessContext` holds the user's businesses and the current one (its id is kept in `localStorage`) and exposes `can(permission)`.
  - Page data uses the small `useApi` hook, which ignores stale responses.
- **API client** (`lib/api.ts`): attaches the access token and, on a 401, performs a single shared refresh before retrying the request.
- **Forms:** React Hook Form with Zod schemas; server field errors are mapped back onto the form.
- **Design:** a "ledger" system (`tailwind.config.js`):
  - Colours: ink navy, paper, ledger green, amber for "due soon" and red for overdue.
  - Type: Public Sans with tabular figures.
  - Signature component: `DueCountdown`, which shows the days left on every obligation in a right-aligned numeric column.
  - Accessibility: labelled fields, focus rings, focus-trapped modals with Escape to close, a skip link, reduced-motion support, and print styles for reports.
