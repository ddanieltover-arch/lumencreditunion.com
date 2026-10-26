import { PrismaClient } from '@prisma/client';

type GlobalPrisma = typeof globalThis & {
  __lumenPrisma?: PrismaClient | null;
  __lumenPrismaInitFailed?: boolean;
};

/**
 * Shared Prisma accessor for serverless. Returns null when DATABASE_URL is
 * missing or `@prisma/client` was not generated (so auth can still work
 * in-memory instead of crashing the login response).
 */
export function getPrisma(): PrismaClient | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const g = globalThis as GlobalPrisma;
  if (g.__lumenPrismaInitFailed) return null;
  if (g.__lumenPrisma) return g.__lumenPrisma;

  try {
    g.__lumenPrisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: ['error'],
    });
    return g.__lumenPrisma;
  } catch (err: unknown) {
    g.__lumenPrismaInitFailed = true;
    g.__lumenPrisma = null;
    console.error(
      '[Prisma] Client init failed (run `prisma generate` in the deploy build):',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
