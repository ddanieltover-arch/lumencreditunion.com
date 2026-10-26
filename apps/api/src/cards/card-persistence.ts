import type { CardCurrency, CardStatus, CardTransactionRecord } from '@lumenfield/shared';
import { getPrisma, type SqlClient } from '../db/prisma';

export type PersistedCard = {
  id: string;
  memberId: string;
  cardToken: string;
  lastFour: string;
  maskedPan: string;
  brand: string;
  currency: CardCurrency;
  status: CardStatus;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  expiryFormatted: string;
  dailyLimitMinor: number;
  monthlyLimitMinor: number;
  spentTodayMinor: number;
  spentThisMonthMinor: number;
  isVirtual: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PersistedCardSnapshot = {
  cards: PersistedCard[];
  transactions: CardTransactionRecord[];
  updatedAt: string;
};

let schemaReady: Promise<void> | null = null;

async function ensureSchema(prisma: SqlClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS card_runtime_store (
          id TEXT PRIMARY KEY,
          snapshot_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((err: unknown) => {
        schemaReady = null;
        console.error('[CardPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

export async function loadPersistedCardSnapshot(): Promise<PersistedCardSnapshot | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    await ensureSchema(prisma);
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT snapshot_json FROM card_runtime_store WHERE id = 'primary' LIMIT 1`,
    )) as Array<{ snapshot_json: PersistedCardSnapshot | string }>;
    if (!rows.length) return null;
    const payload = rows[0].snapshot_json;
    return typeof payload === 'string'
      ? (JSON.parse(payload) as PersistedCardSnapshot)
      : payload;
  } catch (err) {
    console.error('[CardPersistence] load failed:', err);
    return null;
  }
}

export async function persistCardSnapshot(snapshot: PersistedCardSnapshot): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    const json = JSON.stringify(snapshot);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO card_runtime_store (id, snapshot_json, updated_at)
      VALUES ('primary', $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        snapshot_json = EXCLUDED.snapshot_json,
        updated_at = NOW()
      `,
      json,
    );
  } catch (err) {
    console.error('[CardPersistence] save failed:', err);
  }
}
