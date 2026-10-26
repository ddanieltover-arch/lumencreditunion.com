/**
 * Vercel Express service entrypoint.
 * Exports the app for Fluid/serverless — do not call listen() here.
 * Local standalone still uses main.ts; unified local dev uses root server.ts.
 *
 * Env: Vercel injects DATABASE_URL (same Neon as local .env). No migrate/reset on deploy.
 */
import 'dotenv/config';
import { createApiApp } from './app.module';

export default createApiApp();
