import type { PrismaClient } from '@prisma/client';
import { getPrisma } from '../db/prisma';

export type PersistedFundingRequest = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  amountMinor: number;
  amountFormatted: string;
  currency: 'USD' | 'CAD' | 'GBP' | 'EUR';
  reason: string;
  sourceHint: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewerNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  ledgerTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
};

let schemaReady: Promise<void> | null = null;

async function ensureSchema(prisma: PrismaClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS funding_request_store (
          id TEXT PRIMARY KEY,
          member_id TEXT NOT NULL,
          status TEXT NOT NULL,
          request_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS funding_request_store_member_idx
          ON funding_request_store (member_id)
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS funding_request_store_status_idx
          ON funding_request_store (status)
        `),
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        schemaReady = null;
        console.error('[FundingPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

export async function loadPersistedFundingRequests(): Promise<PersistedFundingRequest[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    await ensureSchema(prisma);
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT request_json FROM funding_request_store`,
    )) as Array<{ request_json: PersistedFundingRequest | string }>;
    return rows
      .map((row) => {
        const payload = row.request_json;
        return typeof payload === 'string'
          ? (JSON.parse(payload) as PersistedFundingRequest)
          : payload;
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[FundingPersistence] load failed:', err);
    return [];
  }
}

export async function persistFundingRequest(
  record: PersistedFundingRequest,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    const json = JSON.stringify(record);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO funding_request_store (id, member_id, status, request_json, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        member_id = EXCLUDED.member_id,
        status = EXCLUDED.status,
        request_json = EXCLUDED.request_json,
        updated_at = NOW()
      `,
      record.id,
      record.memberId,
      record.status,
      json,
    );
  } catch (err) {
    console.error('[FundingPersistence] save failed:', err);
  }
}
