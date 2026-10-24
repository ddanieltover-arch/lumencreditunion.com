import { PrismaClient } from '@prisma/client';
import type { UserRecord } from './auth.service';

type GlobalPrisma = typeof globalThis & { __lumenPrisma?: PrismaClient };

function getPrisma(): PrismaClient | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;
  const g = globalThis as GlobalPrisma;
  if (!g.__lumenPrisma) {
    g.__lumenPrisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: ['error'],
    });
  }
  return g.__lumenPrisma;
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema(prisma: PrismaClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS auth_runtime_store (
          user_id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          user_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS auth_runtime_store_email_idx
          ON auth_runtime_store (lower(email))
        `),
      )
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null;
        console.error('[AuthPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

export async function loadPersistedUsers(): Promise<UserRecord[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    await ensureSchema(prisma);
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT user_json FROM auth_runtime_store`,
    )) as Array<{ user_json: UserRecord | string }>;
    return rows
      .map((row) => {
        const payload = row.user_json;
        return typeof payload === 'string' ? (JSON.parse(payload) as UserRecord) : payload;
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[AuthPersistence] load failed:', err);
    return [];
  }
}

export async function persistUser(user: UserRecord): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    const json = JSON.stringify({
      ...user,
      lockedUntil: user.lockedUntil ? new Date(user.lockedUntil).toISOString() : null,
    });
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO auth_runtime_store (user_id, email, role, user_json, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        user_json = EXCLUDED.user_json,
        updated_at = NOW()
      `,
      user.id,
      user.email.toLowerCase(),
      user.role,
      json,
    );
  } catch (err) {
    console.error('[AuthPersistence] save failed:', err);
  }
}

export async function deletePersistedUser(userId: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    await prisma.$executeRawUnsafe(`DELETE FROM auth_runtime_store WHERE user_id = $1`, userId);
  } catch (err) {
    console.error('[AuthPersistence] delete failed:', err);
  }
}
