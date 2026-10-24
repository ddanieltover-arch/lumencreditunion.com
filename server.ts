import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './apps/api/src/app.module';

async function startServer() {
  const app = express();

  // Create API App with all authentication, ledger, countries, and audit routes
  const apiApp = createApiApp();
  app.use(apiApp);

  const port = Number(process.env.PORT) || 5175;

  // Create Vite dev server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Mount Vite connect middleware for frontend SPA
  app.use(vite.middlewares);

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Lumenfield] Fullstack server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[Lumenfield] Failed to start server:', err);
  process.exit(1);
});
