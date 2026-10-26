import 'dotenv/config';
import { createApiApp } from './app.module';
import { ConfigService } from './config/config.service';
import { getDatabaseHost } from './db/prisma';

const config = ConfigService.getInstance();
const app = createApiApp();
const port = config.port;

app.listen(port, () => {
  console.log(`[Lumenfield API] Running on http://localhost:${port}`);
  console.log(`[Lumenfield API] Sandbox Mode: ${config.isSandbox}`);
  console.log(`[Lumenfield API] Production Mode: ${config.isProduction}`);
  console.log(`[Lumenfield API] Require Second Approver: ${config.requireSecondApprover}`);
  console.log(`[Lumenfield API] DATABASE host: ${getDatabaseHost() || '(not set)'}`);
});
