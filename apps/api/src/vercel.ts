/**
 * Vercel Express service entrypoint.
 * Exports the app for Fluid/serverless — do not call listen() here.
 * Local standalone still uses main.ts; unified local dev uses root server.ts.
 */
import { createApiApp } from './app.module';

export default createApiApp();
