import { getPrisma, type SqlClient } from '../db/prisma';
import type { StoredEncryptedDocument } from './private-document-storage.service';

let schemaReady: Promise<void> | null = null;

async function ensureSchema(db: SqlClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = db
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS kyc_document_store (
          file_key TEXT PRIMARY KEY,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          checksum TEXT NOT NULL,
          file_size INT NOT NULL,
          iv TEXT NOT NULL,
          auth_tag TEXT NOT NULL,
          encrypted_data BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((err: unknown) => {
        schemaReady = null;
        console.error('[KycDocumentPersistence] Failed to ensure schema:', err);
        throw err;
      });
  }
  await schemaReady;
}

type DocRow = {
  file_key: string;
  file_name: string;
  mime_type: string;
  checksum: string;
  file_size: number;
  iv: string;
  auth_tag: string;
  encrypted_data: Buffer | Uint8Array | string;
  created_at: Date | string;
};

function toBuffer(data: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  // pg may return hex-encoded bytea as \\x...
  if (typeof data === 'string' && data.startsWith('\\x')) {
    return Buffer.from(data.slice(2), 'hex');
  }
  return Buffer.from(data, 'base64');
}

export async function persistEncryptedDocument(
  record: StoredEncryptedDocument,
): Promise<void> {
  const db = getPrisma();
  if (!db) {
    console.warn(
      '[KycDocumentPersistence] DATABASE_URL missing — KYC document will not survive cold starts.',
    );
    return;
  }
  try {
    await ensureSchema(db);
    await db.$executeRawUnsafe(
      `
      INSERT INTO kyc_document_store (
        file_key, file_name, mime_type, checksum, file_size, iv, auth_tag, encrypted_data, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
      ON CONFLICT (file_key) DO UPDATE SET
        file_name = EXCLUDED.file_name,
        mime_type = EXCLUDED.mime_type,
        checksum = EXCLUDED.checksum,
        file_size = EXCLUDED.file_size,
        iv = EXCLUDED.iv,
        auth_tag = EXCLUDED.auth_tag,
        encrypted_data = EXCLUDED.encrypted_data
      `,
      record.fileKey,
      record.fileName,
      record.mimeType,
      record.checksum,
      record.fileSize,
      record.iv,
      record.authTag,
      record.encryptedData,
      record.createdAt,
    );
  } catch (err) {
    console.error('[KycDocumentPersistence] save failed:', err);
  }
}

export async function loadPersistedEncryptedDocument(
  fileKey: string,
): Promise<StoredEncryptedDocument | null> {
  const db = getPrisma();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const rows = (await db.$queryRawUnsafe(
      `
      SELECT file_key, file_name, mime_type, checksum, file_size, iv, auth_tag, encrypted_data, created_at
      FROM kyc_document_store
      WHERE file_key = $1
      LIMIT 1
      `,
      fileKey,
    )) as DocRow[];
    const row = rows[0];
    if (!row) return null;
    return {
      fileKey: row.file_key,
      fileName: row.file_name,
      mimeType: row.mime_type as StoredEncryptedDocument['mimeType'],
      checksum: row.checksum,
      fileSize: Number(row.file_size),
      iv: row.iv,
      authTag: row.auth_tag,
      encryptedData: toBuffer(row.encrypted_data),
      createdAt:
        typeof row.created_at === 'string'
          ? row.created_at
          : new Date(row.created_at).toISOString(),
    };
  } catch (err) {
    console.error('[KycDocumentPersistence] load failed:', err);
    return null;
  }
}

export async function deletePersistedEncryptedDocument(fileKey: string): Promise<void> {
  const db = getPrisma();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.$executeRawUnsafe(
      `DELETE FROM kyc_document_store WHERE file_key = $1`,
      fileKey,
    );
  } catch (err) {
    console.error('[KycDocumentPersistence] delete failed:', err);
  }
}
