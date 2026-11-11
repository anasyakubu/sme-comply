// Vite configuration for the React application and production build.
// Keep Vitest-only options in vitest.config.ts to avoid TypeScript TS2769.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
