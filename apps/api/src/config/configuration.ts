import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  WEB_PORT: z.coerce.number().default(3000),

  // Platform Safety & Sandbox Flags (Hard Rules 4 & 5)
  SANDBOX_MODE: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? true : val.toLowerCase() === 'true')),
  PRODUCTION_MODE: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? false : val.toLowerCase() === 'true')),
  REQUIRE_SECOND_APPROVER: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? false : val.toLowerCase() === 'true')),

  // Database & Redis
  DATABASE_URL: z
    .string()
    .default('postgresql://lumenfield_user:lumenfield_secret_pass@localhost:5432/lumenfield_db?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth & Security
  JWT_SECRET: z.string().default('lumenfield_dev_super_secret_jwt_access_key_2026_at_least_32_chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().default('lumenfield_dev_super_secret_jwt_refresh_key_2026_at_least_32_chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Rate Limiting
  RATE_LIMIT_TTL_SEC: z.coerce.number().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Transfer Limits & Fraud Rules
  TRANSFER_DAILY_LIMIT_MINOR: z.coerce.number().default(500000), // $5,000.00 per day
  TRANSFER_TRANSACTION_LIMIT_MINOR: z.coerce.number().default(200000), // $2,000.00 per transfer
  TRANSFER_MFA_THRESHOLD_MINOR: z.coerce.number().default(50000), // $500.00 requires MFA step-up
  BENEFICIARY_COOLING_OFF_HOURS: z.coerce.number().default(24),
  TRANSFER_VELOCITY_MAX_PER_HOUR: z.coerce.number().default(5),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const errorIssues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`[Config Error] Invalid application configuration: ${errorIssues}`);
  }
  return result.data;
}
