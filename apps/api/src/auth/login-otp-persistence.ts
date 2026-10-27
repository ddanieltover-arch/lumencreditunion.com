import { getPrisma, type SqlClient } from '../db/prisma';

export type LoginOtpChallenge = {
  ticketId: string;
  userId: string;
  otpHash: string;
  attempts: number;
  expiresAt: string; // ISO
  lastSentAt: string; // ISO
  createdAt: string; // ISO
};

let schemaReady: Promise<void> | null = null;

async function ensureSchema(db: SqlClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS auth_login_otp_store (
          ticket_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          challenge_json JSONB NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() =>
        db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS auth_login_otp_store_user_idx
          ON auth_login_otp_store (user_id)
        `),
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        schemaReady = null;
        console.error('[LoginOtpPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

export async function loadPersistedLoginOtp(
  ticketId: string,
): Promise<LoginOtpChallenge | null> {
  const db = getPrisma();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const rows = (await db.$queryRawUnsafe(
      `SELECT challenge_json FROM auth_login_otp_store WHERE ticket_id = $1 LIMIT 1`,
      ticketId,
    )) as Array<{ challenge_json: LoginOtpChallenge | string }>;
    const row = rows[0];
    if (!row) return null;
    const payload =
      typeof row.challenge_json === 'string'
        ? (JSON.parse(row.challenge_json) as LoginOtpChallenge)
        : row.challenge_json;
    return payload?.ticketId ? payload : null;
  } catch (err) {
    console.error('[LoginOtpPersistence] load failed:', err);
    return null;
  }
}

export async function persistLoginOtp(challenge: LoginOtpChallenge): Promise<void> {
  const db = getPrisma();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.$executeRawUnsafe(
      `
      INSERT INTO auth_login_otp_store (ticket_id, user_id, challenge_json, expires_at, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::timestamptz, NOW())
      ON CONFLICT (ticket_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        challenge_json = EXCLUDED.challenge_json,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
      `,
      challenge.ticketId,
      challenge.userId,
      JSON.stringify(challenge),
      challenge.expiresAt,
    );
  } catch (err) {
    console.error('[LoginOtpPersistence] save failed:', err);
  }
}

export async function deletePersistedLoginOtp(ticketId: string): Promise<void> {
  const db = getPrisma();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.$executeRawUnsafe(
      `DELETE FROM auth_login_otp_store WHERE ticket_id = $1`,
      ticketId,
    );
  } catch (err) {
    console.error('[LoginOtpPersistence] delete failed:', err);
  }
}
