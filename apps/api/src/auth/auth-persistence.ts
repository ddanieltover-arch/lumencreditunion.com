import { PrismaClient } from '@prisma/client';
import type { SessionRecord, UserRecord } from './auth.service';

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
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS auth_session_store (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS auth_session_store_user_idx
          ON auth_session_store (user_id)
        `),
      )
      .then(() => undefined)
      .catch((err: unknown) => {
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
    await prisma.$executeRawUnsafe(`DELETE FROM auth_session_store WHERE user_id = $1`, userId);
  } catch (err) {
    console.error('[AuthPersistence] delete failed:', err);
  }
}

type PersistedSessionJson = Omit<SessionRecord, 'expiresAt' | 'revokedAt'> & {
  expiresAt: string;
  revokedAt: string | null;
};

function deserializeSession(raw: PersistedSessionJson | SessionRecord): SessionRecord {
  return {
    ...raw,
    expiresAt: new Date(raw.expiresAt),
    revokedAt: raw.revokedAt ? new Date(raw.revokedAt) : null,
  };
}

export async function loadPersistedSessions(): Promise<SessionRecord[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    await ensureSchema(prisma);
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT session_json FROM auth_session_store`,
    )) as Array<{ session_json: PersistedSessionJson | string }>;
    return rows
      .map((row) => {
        const payload =
          typeof row.session_json === 'string'
            ? (JSON.parse(row.session_json) as PersistedSessionJson)
            : row.session_json;
        return deserializeSession(payload);
      })
      .filter((s) => s?.id);
  } catch (err) {
    console.error('[AuthPersistence] session load failed:', err);
    return [];
  }
}

export async function persistSession(session: SessionRecord): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    const json = JSON.stringify({
      ...session,
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
    });
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO auth_session_store (session_id, user_id, session_json, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (session_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        session_json = EXCLUDED.session_json,
        updated_at = NOW()
      `,
      session.id,
      session.userId,
      json,
    );
  } catch (err) {
    console.error('[AuthPersistence] session save failed:', err);
  }
}

export async function deletePersistedSession(sessionId: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    await prisma.$executeRawUnsafe(
      `DELETE FROM auth_session_store WHERE session_id = $1`,
      sessionId,
    );
  } catch (err) {
    console.error('[AuthPersistence] session delete failed:', err);
  }
}
