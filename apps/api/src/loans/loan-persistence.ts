import { PrismaClient } from '@prisma/client';

export type PersistedLoanApplication = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  type: 'auto' | 'mortgage';
  requestedAmount: number;
  termMonths: number;
  purpose: string;
  assetDetails?: string;
  downPayment?: number;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  currency: string;
  createdAt: string;
  updatedAt?: string;
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
        CREATE TABLE IF NOT EXISTS loan_application_store (
          id TEXT PRIMARY KEY,
          member_id TEXT NOT NULL,
          status TEXT NOT NULL,
          loan_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS loan_application_store_member_idx
          ON loan_application_store (member_id)
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS loan_application_store_status_idx
          ON loan_application_store (status)
        `),
      )
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null;
        console.error('[LoanPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

export async function loadPersistedLoans(): Promise<PersistedLoanApplication[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    await ensureSchema(prisma);
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT loan_json FROM loan_application_store`,
    )) as Array<{ loan_json: PersistedLoanApplication | string }>;
    return rows
      .map((row) => {
        const payload = row.loan_json;
        return typeof payload === 'string'
          ? (JSON.parse(payload) as PersistedLoanApplication)
          : payload;
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[LoanPersistence] load failed:', err);
    return [];
  }
}

export async function persistLoanApplication(
  loan: PersistedLoanApplication,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    const json = JSON.stringify(loan);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO loan_application_store (id, member_id, status, loan_json, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        member_id = EXCLUDED.member_id,
        status = EXCLUDED.status,
        loan_json = EXCLUDED.loan_json,
        updated_at = NOW()
      `,
      loan.id,
      loan.memberId,
      loan.status,
      json,
    );
  } catch (err) {
    console.error('[LoanPersistence] save failed:', err);
  }
}
