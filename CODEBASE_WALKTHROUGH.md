# SME Comply codebase walkthrough

This document accompanies educational comments in the application source. All descriptions refer to the project as supplied for this commenting pass; no application logic was rewritten.

## How a request moves through the system

1. **React screens** (`client/src/pages`) render forms and lists. Shared components live under `client/src/components`.
2. **Frontend context and hooks** (`context`, `hooks`) store the current account/business and manage loading, errors, and permissions.
3. **HTTP client** (`client/src/lib/api.ts`) sends requests, attaches an in-memory access token, and refreshes the session using a cookie.
4. **Express routes** (`server/src/routes/index.ts`) attach authentication, role checks, schema validation, and upload/rate-limit middleware.
5. **Controllers** translate HTTP requests to **services**, which perform business rules, authorization, and audit logging.
6. **Repositories** wrap **Mongoose models** (`server/src/models`) to read and write MongoDB records.

## Compliance engine and recurring work

- `engine/applicability.ts` checks whether a requirement applies to a business from its facts and rule tree.
- `engine/periods.ts` builds reporting periods; `engine/dueDate.ts` computes each filing deadline.
- `engine/planner.ts` combines those pieces into proposed tasks, with no database writes.
- `services/taskGeneration.service.ts` persists missing tasks, preserves existing progress, and updates applicability/status.
- `jobs/scheduler.ts` runs background compliance maintenance; `services/reminder.service.ts` sends configured automatic reminders once per reminder window.

## Manual communication (independent of the scheduler)

- `client/src/pages/admin/AdminComposeEmail.tsx` is the Super Admin compose screen for ordinary emails or reminders. It loads eligible obligations when needed.
- `server/src/routes/index.ts` requires the `SUPER_ADMIN` role and validates request bodies before calling `controllers/manualEmail.controller.ts`.
- `services/manualEmail.service.ts` verifies recipients and obligation membership, creates an `EmailLog` before SMTP, sends through `services/email.service.ts`, then writes the outcome and audit entry.
- `models/EmailLog.ts` retains failures as well as accepted sends. Its unique actor/request ID index stops duplicate delivery attempts. “Sent” denotes SMTP acceptance, not guaranteed inbox delivery.
- `client/src/pages/admin/AdminEmailHistory.tsx` lists attempts and retrieves full content for the detail dialog.
- Manual sending does **not** depend on `ReminderSetting` or the scheduled reminder job.

## Data model relationships

- A `User` can own many `Business` records. `BusinessMember` associates other users with a business and determines their permissions.
- `RegulatoryAgency` issues `RegulatoryRequirement` records. Each requirement stores an applicability tree and due-date rule.
- Each `ComplianceTask` links a business, requirement, and period; a unique compound index prevents duplicate planned tasks.
- `FilingRecord` and `Document` capture completed filing activity and evidence linked to tasks/businesses.
- `Notification` records in-app events and deduplicated automatic reminder windows, while `ReminderSetting` stores per-business scheduled preferences.
- `EmailLog` and `AuditLog` provide separate histories of Super Admin message attempts and administrative activity.
- `RefreshToken` stores hashed rotating session tokens with expiry.

## Security principles to explain at a project defense

- Frontend guards are for user experience; server middleware enforces platform and business permissions.
- Request validation happens at the API boundary even when the frontend already validates the same form.
- Email credentials remain in server environment variables; the browser never receives SMTP secrets.
- The manual email workflow uses a unique request ID to prevent duplicate submissions, even under concurrent requests.
- Completed tasks and existing filing history are preserved during automatic task regeneration.

## Useful paths for a walkthrough

Start at `client/src/App.tsx`, follow `client/src/lib/api.ts` to `server/src/routes/index.ts`, then a controller, its service, repository, and database model. For deadlines, follow `engine/planner.ts` into `services/taskGeneration.service.ts`; for reminders, contrast scheduled `services/reminder.service.ts` with on-demand `services/manualEmail.service.ts`.
