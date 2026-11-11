# Deployment

The API and the web app deploy separately. The recommended free-tier setup is MongoDB Atlas for the database, Render or Railway for the API, and Vercel or Netlify for the web app. A Docker Compose file is also included.

## 1. Database: MongoDB Atlas

1. Create a free M0 cluster.
2. Under **Database Access**, create a user with read/write access.
3. Under **Network Access**, allow the IP addresses of your API host. `0.0.0.0/0` works but is the least safe option.
4. Copy the connection string and add a database name, for example `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/sme_comply?retryWrites=true&w=majority`.

Indexes, including the duplicate-guard and reminder-dedupe unique indexes, are created by Mongoose when the API starts.

## 2. API: Render (or Railway)

- **Root directory:** `server`
- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Health check path:** `/health`

Environment variables (see `server/.env.example`):

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | the Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | two different random strings of 48+ bytes. The server refuses to start with the example values |
| `CLIENT_URL` | the web app origin, e.g. `https://sme-comply.vercel.app`. This is the CORS allow-list; separate several with commas |
| `SERVER_URL` | the API's public URL (used in links for locally stored files) |
| `APP_TIMEZONE` | `Africa/Lagos` |
| `SMTP_*` | the credentials of any SMTP provider (Brevo, Mailgun, SendGrid, Gmail app password) |
| `CLOUDINARY_*` | Cloudinary credentials. **Set these in production:** most hosts have ephemeral disks, so local uploads would be lost on redeploy |
| `REMINDER_CRON` | `0 7 * * *` |
| `ENABLE_JOBS` | `true` on exactly one instance |

**Cookies across domains.** In production the refresh cookie is sent with `SameSite=None; Secure`, so the API must be served over HTTPS. Render and Railway do this by default. `trust proxy` is already enabled so secure cookies work behind their load balancers.

**Scheduled jobs.** The cron scheduler runs inside the API process. Free Render services sleep when idle, which pauses the scheduler. To keep reminders running, do one of the following:
- Use a paid or always-on instance.
- Ping `/health` every few minutes with an uptime monitor.
- Trigger `POST /api/v1/admin/jobs/reminders` from an external scheduler, authenticated as an admin.

Missed days are caught up on the next run, and reminders are never sent twice.

**Seeding.** The seed script deletes all data, so run it only on a fresh database, from a one-off shell:

```bash
SEED_FORCE=true npm run seed    # after build: SEED_FORCE=true node dist/seed/seed.js
```

Then change the demo passwords, or deactivate the demo accounts from the admin panel.

## 3. Web app: Vercel (or Netlify)

- **Root directory:** `client`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variable:** `VITE_API_URL=https://<your-api-host>/api/v1`. This is read at build time, so redeploy after changing it.

Because this is a single-page app, add a rewrite so deep links load `index.html`.

- Vercel, in `client/vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- Netlify, in `client/public/_redirects`:
  ```
  /*  /index.html  200
  ```

Finally, set the API's `CLIENT_URL` to the deployed web origin.

## 4. Docker Compose (local or a single VM)

```bash
cp server/.env.example server/.env     # set the JWT secrets (and SMTP/Cloudinary if wanted)
docker compose up --build -d
docker compose exec server node dist/seed/seed.js
```

| Service | URL |
|---|---|
| Web app (nginx) | http://localhost:8080 |
| API | http://localhost:5000 (Swagger at `/api-docs`) |
| MongoDB | localhost:27017, with data in the `mongo-data` volume |

The compose file runs the API with `NODE_ENV=development` because it serves plain HTTP on localhost, where `Secure` cookies would be rejected. For an internet-facing VM, put a TLS reverse proxy (Caddy, nginx or Traefik) in front and switch to `NODE_ENV=production`, with real secrets and `CLIENT_URL` set to the public origin.

## Pre-launch checklist

- [ ] Strong, unique JWT secrets; `NODE_ENV=production`
- [ ] `CLIENT_URL` restricted to the real web origin
- [ ] Cloudinary configured
- [ ] SMTP configured and a test reminder received (Admin → Overview → Run reminder job now)
- [ ] Demo accounts removed or given new passwords
- [ ] Sample regulatory data reviewed against official sources, and `isSampleData` cleared only once verified
- [ ] Database backups enabled (Atlas has snapshots on paid tiers; otherwise schedule `mongodump`)
- [ ] Uptime monitor on `/health`
