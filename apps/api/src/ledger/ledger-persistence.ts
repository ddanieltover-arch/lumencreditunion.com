import { PrismaClient } from '@prisma/client';
import type { AccountRecord, LedgerTransactionRecord } from './ledger.service';

export type PersistedLedgerSnapshot = {
  accounts: AccountRecord[];
  memberWallets: Array<[string, string]>;
  transactions: LedgerTransactionRecord[];
  updatedAt: string;
};

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
        CREATE TABLE IF NOT EXISTS ledger_runtime_store (
          id TEXT PRIMARY KEY,
          snapshot_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((err: unknown) => {
        schemaReady = null;
        console.error('[LedgerPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

export async function loadPersistedLedgerSnapshot(): Promise<PersistedLedgerSnapshot | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    await ensureSchema(prisma);
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT snapshot_json FROM ledger_runtime_store WHERE id = 'primary' LIMIT 1`,
    )) as Array<{ snapshot_json: PersistedLedgerSnapshot | string }>;
    if (!rows.length) return null;
    const payload = rows[0].snapshot_json;
    return typeof payload === 'string'
      ? (JSON.parse(payload) as PersistedLedgerSnapshot)
      : payload;
  } catch (err) {
    console.error('[LedgerPersistence] load failed:', err);
    return null;
  }
}

export async function persistLedgerSnapshot(
  snapshot: PersistedLedgerSnapshot,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    const json = JSON.stringify(snapshot);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO ledger_runtime_store (id, snapshot_json, updated_at)
      VALUES ('primary', $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        snapshot_json = EXCLUDED.snapshot_json,
        updated_at = NOW()
      `,
      json,
    );
  } catch (err) {
    console.error('[LedgerPersistence] save failed:', err);
  }
}
