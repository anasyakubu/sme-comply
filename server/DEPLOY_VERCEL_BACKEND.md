# SME Comply backend — Vercel deployment guide

This ZIP contains the **complete backend** (source code, tests, package metadata, `index.ts`, `vercel.json`, example environment variables). It is not the frontend.

## Vercel project setup

1. Extract this ZIP into the `server/` folder in your SME Comply repository, replacing the old backend files. If deploying this ZIP as its own repository, put its contents at the repository root.
2. Push the changes to your Git provider, then import or redeploy the backend as a **separate Vercel project**.
3. Set **Root Directory** to `server` when deploying from the original monorepo (or `.` for a standalone backend repository).
4. Use **Framework Preset: Express**; leave **Build Command** and **Output Directory** **unset / automatic**. Vercel recognizes `index.ts` automatically. Do not configure `npm start` as the Vercel build command. Node.js is pinned to **22.x** in `package.json`.
5. Add backend environment variables in Vercel Project Settings → Environment Variables. Deploy after updating them.

## Required environment variables

| Key | Example or explanation |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Valid **MongoDB Atlas** `mongodb+srv://...` connection URI (not localhost). Atlas network access must allow your deployment. |
| `JWT_ACCESS_SECRET` | A distinct strong, unpredictable secret (generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). |
| `JWT_REFRESH_SECRET` | Another independent, strong secret. |
| `CLIENT_URL` | `https://YOUR-FRONTEND.vercel.app` (no trailing slash). Comma-separate allowed origins if you also use a custom domain. |
| `SERVER_URL` | `https://YOUR-BACKEND.vercel.app` (no trailing slash). |
| `CRON_SECRET` | A long random secret; Vercel sends it as `Authorization: Bearer ...` to the cron endpoint. |
| `ENABLE_JOBS` | `false` — no in-process scheduled jobs in serverless deployment. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (needed for document uploads). |
| `CLOUDINARY_API_KEY` | Cloudinary API key (server secret). |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (server secret). |

Optional: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` if the application will send email. Never put server secrets in a `VITE_` variable.

The original `src/server.ts` and `npm run dev` still work for local, long-running hosting; they are not the Vercel entry point.

## Frontend configuration

The frontend project should have its own Vercel deployment and its own `VITE_API_URL` variable:

```
VITE_API_URL=https://YOUR-BACKEND.vercel.app/api/v1
```

Rebuild/redeploy the frontend when that variable changes. Ensure `CLIENT_URL` on the backend matches the exact frontend scheme and host to avoid CORS errors.

## Health checks

- `GET https://YOUR-BACKEND.vercel.app/` — checks the function has started (does not need MongoDB).
- `GET https://YOUR-BACKEND.vercel.app/health` — checks the Express API and requires successful MongoDB access.
- `GET https://YOUR-BACKEND.vercel.app/api-docs.json` — OpenAPI schema (also requires MongoDB due to readiness guard).
- `GET https://YOUR-BACKEND.vercel.app/api/v1/...` — existing versioned API routes (authentication required for most).

If `/` works but `/health` returns `503`, check your MongoDB connection URI and Atlas network-access rules. If `/` returns `500`, check Vercel runtime logs and production JWT environment variables.

## Daily compliance reminders

Vercel calls `GET /internal/cron/daily` on the production deployment at **06:00 UTC**, equivalent to **07:00 Africa/Lagos**. The route rejects missing/invalid `CRON_SECRET` with `401` and runs task generation, status refresh, and reminders. The daily job is at most once per day on a Vercel Hobby plan and might start late; task duration is limited by Vercel Functions. The original hourly in-process refresh does not run on Vercel. For long jobs or stricter schedules, use a persistent worker/queue.

## Document uploads / static files

On Vercel, local file storage is not persistent. The backend now responds with a clear `503` if a document upload would fall back to local disk; configure Cloudinary before enabling production uploads. Existing Cloudinary uploads remain supported, but Vercel Functions currently have a **4.5 MB total request-body limit**: uploads larger than this fail with `413` before reaching Multer, even if `MAX_UPLOAD_MB=10`. For larger files, use a direct-to-Cloudinary signed upload workflow. Vercel ignores `express.static()`, so `/uploads/*` on Vercel is not a production file host, and Swagger UI static CSS/JS may not load at `/api-docs` (the `/api-docs.json` endpoint remains available). Consider external hosting for Swagger UI if needed.

## Local verification

From the backend directory, with Node.js 22:

```bash
npm install
npm run typecheck:vercel
npm run build
npm test
```

For local server development:

```bash
cp .env.example .env
# Edit .env with valid local credentials
npm run dev
```

**Caution:** The included `npm run seed` command clears database collections. Never run it against production data unless you intend to erase and reseed the database.

## Validation note

This ZIP was reviewed for ZIP integrity, valid JSON and TypeScript syntax. A full `npm install`, TypeScript typecheck and integration test run are dependent on npm registry access and live service credentials; verify those in your CI or Vercel build logs.
