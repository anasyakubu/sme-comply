# API reference

- **Base URL:** `/api/v1`.
- **Interactive docs:** Swagger UI at `/api-docs`; the raw spec is at `/api-docs.json`.
- **Health check:** `GET /health`.

## Conventions

**Response envelope**

```json
{ "success": true, "message": "Tasks retrieved", "data": [ ... ], "meta": { "page": 1, "limit": 25, "total": 83, "totalPages": 4 } }
```

**Errors** use the same shape with `success: false`, plus `errors` for validation failures:

```json
{ "success": false, "message": "Validation failed", "errors": [{ "path": "email", "message": "Invalid email" }] }
```

| Status | Meaning |
|---|---|
| 400 | Validation error, bad file type, or file contents not matching the extension |
| 401 | Missing, invalid or expired token |
| 403 | Signed in, but your role lacks the permission |
| 404 | Not found, or not in a business you belong to |
| 409 | Duplicate (email, agency acronym, requirement code) |
| 413 | File too large |
| 429 | Rate limit exceeded |

**Authentication:** `Authorization: Bearer <accessToken>`. The refresh token travels in an httpOnly cookie, so send requests with credentials.

**Lists** accept `page`, `limit` (max 100), `sort` (allow-listed fields, prefix with `-` for descending) and `search`.

## Endpoints

### Auth: `/auth`
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/register` | firstName, lastName, email, phone?, password | Returns `{ user, accessToken }` and sets the refresh cookie |
| POST | `/login` | email, password | Same response |
| POST | `/refresh` | none (cookie) | Rotates the refresh token |
| POST | `/logout` | none | Revokes the refresh token |
| POST | `/forgot-password` | email | Always returns 200 |
| POST | `/reset-password` | token, password | |
| POST | `/verify-email` | token | |
| POST | `/resend-verification` | none | Requires auth |
| GET | `/me` | none | |

### Users: `/users`
`GET /me`, `PATCH /me` (firstName, lastName, phone), `POST /me/password` (currentPassword, newPassword).

### Lookups
`GET /lookups/options` returns business types, industries, states, frequencies, categories, document types, rule fields, operators and due-rule types.

### Businesses: `/businesses`
| Method | Path | Permission |
|---|---|---|
| GET | `/` | Member (admins see all). Each item includes `myRole` and a `compliance` summary |
| POST | `/` | Any signed-in user; the creator becomes owner. Returns `{ business, generation }` |
| GET | `/:id` | `business:view`. Includes `myRole` and `myPermissions` |
| PATCH | `/:id` | `business:update`. Regenerates tasks if applicability fields change |
| POST | `/:id/close` | `business:update` |
| POST | `/:id/regenerate-tasks` | `business:update` |
| GET | `/:id/dashboard` | `business:view` |
| GET, POST | `/:id/members` | view / `members:manage` (email, role) |
| PATCH, DELETE | `/:id/members/:memberId` | `members:manage` |
| GET, PUT | `/:id/reminder-settings` | view / `reminders:manage` |

`GET /business-members/:businessId` is an alias for the members list.

### Regulatory data
| Method | Path | Permission |
|---|---|---|
| GET | `/agencies`, `/agencies/:id` | Signed in |
| POST, PATCH | `/agencies`, `/agencies/:id` | Admin |
| GET | `/requirements`, `/requirements/:id` | Signed in |
| POST, PATCH | `/requirements`, `/requirements/:id` | Admin. Rules are validated; obligations regenerate in the background |
| POST | `/requirements/preview` | Admin. `{ applicabilityRules }` → matching business count and sample |

### Compliance tasks: `/compliance-tasks`
| Method | Path | Notes |
|---|---|---|
| GET | `/` | `businessId` (required), `status` (comma list), `category`, `agencyId`, `from`, `to`, `search`, `includeNotApplicable` |
| GET | `/calendar` | `businessId`, `from`, `to`, `status?`, `agencyId?` |
| GET | `/:id` | Returns `{ task, filings, documents, permissions }` |
| PATCH | `/:id/status` | `{ status }`. `NOT_APPLICABLE` needs `tasks:mark_not_applicable` |
| POST | `/:id/complete` | `tasks:update` |
| POST | `/:id/notes` | `{ body }` |
| PATCH | `/:id/assign` | `{ assigneeId }` (a member, or `null` to unassign) |

### Filings: `/filings`
`GET /?businessId=&status=&search=`, `POST /` (taskId, filingDate, referenceNumber?, status, submittedTo?, amountPaid?, notes?, documents?, markTaskCompleted?), `PATCH /:id`, `DELETE /:id`. All require `filings:record`.

### Documents: `/documents`
`GET /?businessId=&taskId=&documentType=&search=`, `POST /` (multipart: `file`, businessId, taskId?, filingId?, documentType, description?), `DELETE /:id`. Allowed types: PDF, DOC, DOCX, JPG, JPEG and PNG, up to `MAX_UPLOAD_MB`.

### Notifications: `/notifications`
`GET /?read=false`, `GET /unread-count`, `POST /read-all`, `PATCH /:id/read`, `DELETE /:id`. Each user sees only their own.

### Reports: `/reports`
`GET /compliance`, `/compliance.csv` and `/compliance.pdf`, each with `?businessId=&from=&to=`. Requires `reports:view`.

### Admin: `/admin` (ADMIN or SUPER_ADMIN)
| Method | Path | Notes |
|---|---|---|
| GET | `/overview` | Platform statistics |
| GET, PATCH | `/users`, `/users/:id` | Role and active status. Only a super admin can grant admin roles; you cannot change your own role or status |
| GET | `/businesses` | All businesses with compliance summaries |
| GET | `/notifications` | Includes a `byType` breakdown |
| GET, POST, PATCH | `/lookups`, `/lookups/:id` | Business types and industries |
| POST | `/jobs/reminders` | Run the reminder job now |
| POST | `/jobs/generate-tasks` | Regenerate obligations for every business |
| GET | `/audit-logs` (also `/audit-logs` at the top level) | `action`, `entity`, `userId`, `businessId`, `from`, `to`. Includes the list of distinct `actions` |

### Super Admin manual emails: `/admin/emails` (SUPER_ADMIN only)

These endpoints are **not** available to regular `ADMIN` accounts. They use the server's
existing Nodemailer transporter, and work regardless of automated reminder settings
or `ENABLE_JOBS`. The recipient is always resolved from a registered active user's ID;
passing a free-form destination address is unsupported.

| Method | Path | Description |
|---|---|---|
| POST | `/admin/emails` | Send one general email or manual reminder; `201` after SMTP acceptance |
| GET | `/admin/emails` | Email history with `page`, `limit`, `type`, `status` filters |
| GET | `/admin/emails/:id` | Full attempt details, including editable message text and obligation snapshot |
| GET | `/admin/emails/obligations?recipientId=:id` | Up to 100 outstanding obligations for the user's active memberships/owned businesses; optional `search` |

Example general email payload (a reminder is **not** created):

```json
{
  "recipientId": "64ef00000000000000000001",
  "requestId": "e4cc4593-4fb4-4732-8c6a-94a064cb7e9f",
  "type": "GENERAL",
  "subject": "Account information",
  "message": "Hello, here is an update.",
  "format": "TEXT"
}
```

For `type: "MANUAL_REMINDER"`, include the selected `taskId` and optionally use
`format: "RICH_TEXT"`. The backend always includes the actual obligation name,
business, due date and requirement details before the editable message. A recipient
must have an active membership or own the task's business; completed and not-applicable
tasks are excluded. `RICH_TEXT` supports a safe subset of Markdown (`**bold**`,
`*italic*`, `[link](https://...)`) converted to HTML. Raw HTML is escaped.

Each delivery attempt creates an `EmailLog` MongoDB document with recipient and
initiator snapshots, subject, message, optional task details, attempted time, status
(`PENDING` while sending, then `SENT`/`FAILED`), SMTP acceptance time, and a sanitized
failure code. No schema migration is required for MongoDB; Mongoose creates the
collection and indexes. A unique `(initiatedBy, requestId)` index rejects repeated
requests with `409` to prevent accidental duplicate SMTP sends. Generate a new UUID
only when intentionally making another attempt. Sending failures return `502` or
`503` (SMTP missing credentials); the attempt is still visible in history.
`SENT` means accepted by SMTP, not guaranteed mailbox delivery.

## Example: create a business

```http
POST /api/v1/businesses
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "businessName": "Adaeze Foods Ltd",
  "businessType": "Limited Liability Company",
  "industry": "Food and Beverage",
  "state": "Lagos",
  "employeeCount": 12,
  "annualTurnover": 60000000,
  "dateOfIncorporation": "2021-05-04",
  "flags": { "cacRegistered": true, "taxRegistered": true, "vatRegistered": true, "pensionRegistered": true, "regulatedProducts": true }
}
```

```json
{
  "success": true,
  "message": "Business created with 71 compliance tasks",
  "data": {
    "business": { "_id": "...", "businessName": "Adaeze Foods Ltd" },
    "generation": { "applicableRequirements": 11, "created": 71, "markedNotApplicable": 0, "reactivated": 0 }
  }
}
```

The counts shown are illustrative and depend on the current date and requirement data.
