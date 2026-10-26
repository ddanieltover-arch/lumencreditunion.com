import type { PrismaClient } from '@prisma/client';
import type { AuditLog } from '@lumenfield/shared';
import { getPrisma } from '../db/prisma';

let schemaReady: Promise<void> | null = null;

async function ensureSchema(prisma: PrismaClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS audit_log_store (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          action TEXT NOT NULL,
          log_json JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS audit_log_store_created_idx
          ON audit_log_store (created_at DESC)
        `),
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        schemaReady = null;
        console.error('[AuditPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

export async function loadPersistedAuditLogs(limit = 500): Promise<AuditLog[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    await ensureSchema(prisma);
    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT log_json FROM audit_log_store
      ORDER BY created_at DESC
      LIMIT $1
      `,
      limit,
    )) as Array<{ log_json: AuditLog | string }>;
    return rows
      .map((row) => {
        const payload = row.log_json;
        return typeof payload === 'string' ? (JSON.parse(payload) as AuditLog) : payload;
      })
      .filter((log) => log?.id);
  } catch (err) {
    console.error('[AuditPersistence] load failed:', err);
    return [];
  }
}

export async function persistAuditLog(log: AuditLog): Promise<void> {
  const prisma = getPrisma();
  if (!prisma || !log.id) return;
  try {
    await ensureSchema(prisma);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO audit_log_store (id, actor_id, action, log_json, created_at)
      VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, NOW()))
      ON CONFLICT (id) DO NOTHING
      `,
      log.id,
      log.actorId,
      log.action,
      JSON.stringify(log),
      log.timestamp || null,
    );
  } catch (err) {
    console.error('[AuditPersistence] save failed:', err);
  }
}
