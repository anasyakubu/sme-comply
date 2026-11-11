# Super Admin manual email & reminder implementation

This feature was integrated into the supplied SME Comply React / Express / Mongoose project.

## Use it

1. Log in as a **SUPER_ADMIN** (not a regular `ADMIN`).
2. Open **Platform overview** and select **Send Email** or **Send Reminder**, or open **Users** and use the action beside an active user.
3. Choose an active registered recipient. An email address is displayed but not editable; it comes from the user record.
4. For a manual reminder, select an outstanding compliance obligation for a business to which the recipient belongs. The backend adds the obligation name, business, due date, period and requirement description regardless of edits to the message.
5. Edit the subject and message. The optional rich-text setting converts safe Markdown to HTML; raw HTML is escaped. Select **Send Email** or **Send Reminder Now**.
6. Check **Email history** for accepted, failed or in-progress attempts and use **View details** for the original message and obligation snapshot.

## Server setup

In `server/.env` (server-side only):

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM="SME Comply <your-account@gmail.com>"
```

Use a Google App Password from an account with the appropriate authentication settings. Port 587 requires STARTTLS. Never set these values in `client/.env`, any `VITE_*` variable, or source code.

For manual sending, missing credentials cause a `503` and a `FAILED` history record; the development JSON transport is not counted as delivery. `SENT` means SMTP accepted the recipient, not confirmed inbox delivery.

The new MongoDB `EmailLog` collection stores delivery-attempt records and has a unique `(initiatedBy, requestId)` index. The server explicitly creates the index on database connection; no SQL migration is involved. Each new attempt requires a fresh UUID. A repeated UUID returns HTTP `409` without a second SMTP send. If a client loses network connectivity while sending, check history before preparing another attempt.

Manual reminder sending does **not** invoke or depend on `reminderService.run()`, `ENABLE_JOBS`, or per-business automatic reminder preferences. Existing scheduler and other email call sites continue to use the same Nodemailer transporter.

## API

- `POST /api/v1/admin/emails` — send one general email (`GENERAL`) or manual reminder (`MANUAL_REMINDER`).
- `GET /api/v1/admin/emails` — paginated delivery history, with `type` and `status` filters.
- `GET /api/v1/admin/emails/:id` — full delivery-attempt details.
- `GET /api/v1/admin/emails/obligations?recipientId=...&search=...` — recipient's outstanding obligations.

All four endpoints require `SUPER_ADMIN`. See `docs/api.md` and `/api-docs` for input fields and response descriptions.

## Test coverage

`server/tests/manualEmail.test.ts` adds tests for general emails, editable reminders (including when scheduled reminders are disabled), bad recipient emails, missing fields, regular-admin/member authorization, unrelated obligations, delivery failures, SMTP-not-configured handling, HTML escaping, and sequential/concurrent duplicate prevention.

Run after installing dependencies:

```bash
npm run install:all
npm test
npm run typecheck
npm run build
```

**Verification limitation for this handoff:** The sandbox had no project npm dependencies, and npm registry DNS was unavailable, so the Vitest integration suite, full TypeScript typecheck, and production bundle build could not be executed here. Local checks did successfully transpile and resolve all TypeScript/TSX relative imports and exercised the HTML email renderer and SMTP transport through isolated runtime mocks. A real Gmail delivery test also requires your valid SMTP credentials and access to the intended recipient mailbox.
