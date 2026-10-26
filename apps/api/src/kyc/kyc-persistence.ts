import type { KycSubmission } from '@lumenfield/shared';
import { getPrisma, type SqlClient } from '../db/prisma';

let schemaReady: Promise<void> | null = null;

async function ensureSchema(prisma: SqlClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS kyc_runtime_store (
          member_id TEXT PRIMARY KEY,
          member_email TEXT NOT NULL,
          status TEXT NOT NULL,
          submission_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS kyc_runtime_store_email_idx
          ON kyc_runtime_store (lower(member_email))
        `),
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        schemaReady = null;
        console.error('[KycPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

export async function loadPersistedKycSubmissions(): Promise<KycSubmission[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  try {
    await ensureSchema(prisma);
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT submission_json FROM kyc_runtime_store`,
    )) as Array<{ submission_json: KycSubmission | string }>;
    return rows
      .map((row) => {
        const payload = row.submission_json;
        return typeof payload === 'string' ? (JSON.parse(payload) as KycSubmission) : payload;
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[KycPersistence] load failed:', err);
    return [];
  }
}

export async function persistKycSubmission(submission: KycSubmission): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    const json = JSON.stringify(submission);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO kyc_runtime_store (member_id, member_email, status, submission_json, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, NOW())
      ON CONFLICT (member_id) DO UPDATE SET
        member_email = EXCLUDED.member_email,
        status = EXCLUDED.status,
        submission_json = EXCLUDED.submission_json,
        updated_at = NOW()
      `,
      submission.memberId,
      submission.memberEmail.toLowerCase(),
      submission.status,
      json,
    );
  } catch (err) {
    console.error('[KycPersistence] save failed:', err);
  }
}

export async function deletePersistedKycSubmission(memberId: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await ensureSchema(prisma);
    await prisma.$executeRawUnsafe(`DELETE FROM kyc_runtime_store WHERE member_id = $1`, memberId);
  } catch (err) {
    console.error('[KycPersistence] delete failed:', err);
  }
}
