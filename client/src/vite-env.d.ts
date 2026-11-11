/// <reference types="vite/client" />
/**
 * Module purpose: Declares Vite-specific TypeScript types and frontend environment variable shapes.
 */

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
