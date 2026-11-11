# SME Comply

An automated regulatory filing tracker and reminder system for Nigerian small and medium-sized businesses.

A business owner describes their business once (type, state, industry, staff count, what they are registered for). SME Comply works out which CAC, tax, pension, state and sector obligations apply, generates each filing with its due date for the next twelve months, sends reminders before and after each deadline, and keeps filing records and supporting documents in one place.

> **Disclaimer.** SME Comply tracks deadlines and keeps records. It does **not** submit filings to any government agency and is **not** legal or tax advice. The regulatory data shipped in `server/src/seed/data.ts` is **sample data** for demonstration and must be verified against the relevant authority before real use. Following the 2025 tax reform, the Federal Inland Revenue Service (FIRS) became the Nigeria Revenue Service (NRS); the sample data uses the new name.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React Router, Axios, React Hook Form, Zod, Recharts, date-fns, FullCalendar, lucide-react, react-hot-toast |
| Backend | Node.js, TypeScript, Express, MongoDB with Mongoose, JWT, bcrypt, Zod, Nodemailer, node-cron, Multer, Cloudinary, Helmet, CORS, Morgan |
| Testing | Vitest, Supertest, mongodb-memory-server, Testing Library |
| Docs | OpenAPI 3 (Swagger UI at `/api-docs`) |

## Features

- **Rules-driven obligations.** Each regulatory requirement stores its frequency, a due-date rule and applicability rules as data. Admins can change them without code changes, and every business's obligations regenerate automatically.
- **Due-date engine** with pluggable rule types: day of month, last day of month, fixed date, days or months after period end, anniversary of incorporation, and days after an anchor date for one-time obligations.
- **Applicability engine** with nested ALL/ANY groups over business type, state, industry, staff count, turnover and registration flags.
- **No duplicate tasks.** A unique index on business + requirement + period makes generation safe to re-run.
- **Reminders** at configurable offsets (default 30, 14, 7, 3, 1 and 0 days before) plus 1, 7, 14 and 30 days overdue. Each reminder is sent once per person per obligation, by email and in the app.
- **Filing records** with reference numbers, amounts and attached evidence. **Document uploads** checked by extension, MIME type and file signature.
- **Dashboard, calendar and reports** with CSV and PDF export.
- **Teams.** Owners invite accountants and compliance officers; each role has its own permissions and sees only their own businesses.
- **Admin panel** for agencies, requirements (visual rule builder with a live "how many businesses match" preview), users, businesses, notifications, dropdown values and the audit log.
- **Security:** Helmet, CORS allow-list, rate limiting, Mongo operator stripping, Zod validation on every input, bcrypt (12 rounds), short-lived access tokens held in memory, and rotating httpOnly refresh tokens with reuse detection.

## Project structure

```
sme-comply/
├── client/                 React web app
│   └── src/
│       ├── components/     ui/ primitives, layout/, tasks/, business/, admin/
│       ├── context/        AuthContext, BusinessContext
│       ├── hooks/          useApi, useDebounce, useLookups
│       ├── lib/            api client, formatters, permissions
│       ├── pages/          public/, app/, admin/
│       └── types/
├── server/                 Express API
│   ├── src/
│   │   ├── config/         env validation, db, constants, cloudinary
│   │   ├── engine/         pure rules engines (periods, due dates, applicability, status, reminders, planner)
│   │   ├── models/         13 Mongoose models
│   │   ├── repositories/   data access
│   │   ├── services/       business logic
│   │   ├── controllers/    HTTP handlers
│   │   ├── routes/         /api/v1 routes
│   │   ├── middleware/     auth, access, validation, upload, errors, rate limit
│   │   ├── validators/     Zod schemas
│   │   ├── jobs/           cron scheduler
│   │   ├── docs/           OpenAPI spec
│   │   └── seed/           sample data and seed script
│   └── tests/              engine unit tests and API integration tests
├── docs/                   architecture, database, API, deployment
└── docker-compose.yml
```

## Getting started

**Requirements:** Node.js 20 or later, and MongoDB 6 or later (local, Docker, or MongoDB Atlas).

### 1. API

```bash
cd server
cp .env.example .env        # set MONGODB_URI and two long random JWT secrets
npm install
npm run seed                # WARNING: clears the database, then loads sample data
npm run dev                 # http://localhost:5000
```

API docs are at http://localhost:5000/api-docs.

If `SMTP_HOST` is empty, existing automated/transactional emails are printed to the console instead of sent.
**Super Admin manual emails are never simulated**: configure Gmail SMTP with
`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER`,
`SMTP_PASSWORD` (a Google App Password), and a Gmail-authorized `SMTP_FROM` in
`server/.env`. The SMTP connection enforces STARTTLS on port 587. SMTP credentials
must remain on the backend and must never be added to the client `.env`.
The Super Admin dashboard provides **Send Email**, **Send Reminder**, and an
**Email history** page. Manual reminders work even if scheduled reminders are
switched off. Manual email attempts, including failures, are stored in MongoDB.
No MongoDB migration is needed; indexes are created by the model. See
`docs/api.md` for the Super Admin email endpoints and idempotency requirements. If Cloudinary is not configured, uploads are stored in `server/uploads/`.

### 2. Web app

```bash
cd client
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api/v1
npm install
npm run dev                 # http://localhost:5173
```

### Or with Docker

```bash
cp server/.env.example server/.env    # set the JWT secrets
docker compose up --build
docker compose exec server node dist/seed/seed.js
```

This serves the web app at http://localhost:8080 and the API at http://localhost:5000.

## Demo accounts (after seeding)

| Email | Password | Role |
|---|---|---|
| superadmin@smecomply.ng | Admin@12345 | Super admin |
| admin@smecomply.ng | Admin@12345 | Admin |
| owner@demo.smecomply.ng | Demo@12345 | Owner of both demo businesses |
| accountant@demo.smecomply.ng | Demo@12345 | Accountant on both demo businesses |
| officer@demo.smecomply.ng | Demo@12345 | Compliance officer, Arewa Tech Solutions |

The two demo businesses are:
- **Arewa Tech Solutions:** limited company in Kano, 15 staff, VAT and pension registered.
- **Mama Nkechi's Kitchen:** sole proprietorship in Lagos, 4 staff, sells regulated food products.

Six months of history is backfilled with filings, including a couple of overdue items, so the dashboard has data to show.

Change or delete these accounts before any real deployment.

## Sample regulatory requirements

All of these are marked `isSampleData` and shown with a "sample" label in the app.

| Agency | Requirement | Frequency |
|---|---|---|
| CAC | Annual returns (company), Annual returns (business name) | Yearly |
| NRS | TIN registration | One-time |
| NRS | VAT return, Withholding tax remittance | Monthly |
| NRS | Company income tax return | Yearly |
| State IRS | PAYE remittance | Monthly |
| State IRS | Employer's annual declaration, Personal income tax return | Yearly |
| PenCom | Pension contribution remittance | Monthly |
| PenCom | Compliance certificate renewal | Yearly |
| NSITF | Employees' Compensation Scheme contribution | Monthly |
| ITF | Training contribution | Yearly |
| NAFDAC | Product registration review | Yearly |
| SON | MANCAP certification review | Yearly |

## Scripts

| Where | Command | What it does |
|---|---|---|
| server | `npm run dev` | API with hot reload |
| server | `npm run seed` | Reset the database and load sample data |
| server | `npm test` | Engine unit tests and API integration tests (in-memory MongoDB) |
| server | `npm run build && npm start` | Production build and run |
| client | `npm run dev` | Web app dev server |
| client | `npm test` | Formatter, permission and component tests |
| client | `npm run build` | Type-check and production build to `client/dist` |
| root | `npm run install:all`, `npm run build`, `npm test` | Run both sides |

## Documentation

- [Architecture](docs/architecture.md): layers, engines, the task lifecycle, scheduling and security.
- [Database](docs/database.md): collections, fields, indexes and relationships.
- [API](docs/api.md): endpoints, response envelope, errors and permissions.
- [Deployment](docs/deployment.md): MongoDB Atlas, Render or Railway, Vercel or Netlify, and Docker.

## Limitations and future work

- Requirement data is illustrative and must be maintained by an administrator against official sources.
- There is no direct integration with agency portals (such as TaxPro Max or the CAC portal); users record filings manually.
- Public holidays and weekend deadline shifts are not modelled yet. The due-date engine accepts new rule types, so this can be added.
- SMS or WhatsApp reminders and multi-currency turnover are out of scope for this version.
