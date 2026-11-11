# SME Comply Frontend — Vercel Deployment

## Fix applied

The production `vite.config.ts` no longer has a `test` property. Vitest now uses its
own `vitest.config.ts` so TypeScript can validate Vite's production configuration
without the `TS2769` error, while retaining jsdom, globals and the test setup file.

## Deploy

1. Extract this ZIP into your frontend repository (the ZIP root contains `package.json`).
2. Commit and push all extracted files, **including the new `vitest.config.ts`**.
3. In Vercel set:
   - Framework Preset: **Vite**
   - Root Directory: **`.`** for a frontend-only repository, or **`client`** if files are in a monorepo's `client/` directory.
   - Build Command: **`npm run build`**
   - Output Directory: **`dist`**
4. Set `VITE_API_URL` in the Vercel project environment variables to your deployed
   backend API root, for example `https://your-backend.vercel.app/api/v1`.
5. Redeploy; if Vercel still shows the previous error, verify that it is building
   the commit containing the updated `vite.config.ts`.

## Verify locally

```bash
npm install
npm run build
npm test
```

Do not use the sample local URL from `.env.example` in production.

The production build could not be executed in the packaging environment because
its npm registry was unreachable. This is a targeted code/config fix, not a claim
of a fully tested production build.
