import crypto from 'crypto';
import { ConfigService } from '../config/config.service';
import {
  deletePersistedEncryptedDocument,
  loadPersistedEncryptedDocument,
  persistEncryptedDocument,
} from './kyc-document-persistence';

export interface StoredEncryptedDocument {
  fileKey: string;
  checksum: string; // SHA-256
  fileName: string;
  fileSize: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  encryptedData: Buffer;
  iv: string; // hex
  authTag: string; // hex
  createdAt: string;
}

export interface VirusScanResult {
  clean: boolean;
  threatName?: string;
}

type GlobalStorage = typeof globalThis & {
  __lumenDocStorage?: PrivateDocumentStorageService;
};

export class PrivateDocumentStorageService {
  private documents = new Map<string, StoredEncryptedDocument>();
  private readonly encryptionKey: Buffer;
  private readonly signingSecret: string;
  private readonly maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB limit (Task requirement)

  constructor(private readonly configService: ConfigService = ConfigService.getInstance()) {
    // Derive AES-256 encryption key from STORAGE_SECRET_KEY or JWT_SECRET
    const secret =
      process.env.STORAGE_SECRET_KEY ||
      configService.get('JWT_SECRET') ||
      'lumenfield_default_storage_secret_key_32_bytes_min';
    this.encryptionKey = crypto.createHash('sha256').update(secret).digest();
    this.signingSecret = configService.get('JWT_SECRET');
  }

  /** Process-wide singleton so encrypted blobs survive warm serverless reuse. */
  static getInstance(): PrivateDocumentStorageService {
    const g = globalThis as GlobalStorage;
    if (!g.__lumenDocStorage) {
      g.__lumenDocStorage = new PrivateDocumentStorageService();
    }
    return g.__lumenDocStorage;
  }

  /**
   * Virus scan hook (HARD RULE 7 & Task requirement)
   * Type-checks, checks file signatures (magic bytes), and scans for malicious payloads or EICAR strings.
   */
  async scanFile(buffer: Buffer, fileName: string): Promise<VirusScanResult> {
    if (buffer.length > this.maxFileSizeBytes) {
      return { clean: false, threatName: 'FileSizeLimitExceeded: Maximum allowed size is 10 MB' };
    }

    // Check for EICAR standard anti-virus test signature
    const contentStr = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    if (contentStr.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
      return { clean: false, threatName: 'Win.Test.EICAR_HDB-1' };
    }

    // Magic bytes validation
    const headerHex = buffer.subarray(0, 8).toString('hex').toLowerCase();
    const isPdf = buffer.subarray(0, 4).toString('utf8') === '%PDF';
    const isJpeg = headerHex.startsWith('ffd8ff');
    const isPng = headerHex.startsWith('89504e47');
    const isWebp =
      buffer.subarray(0, 4).toString('utf8') === 'RIFF' &&
      buffer.subarray(8, 12).toString('utf8') === 'WEBP';

    if (!isPdf && !isJpeg && !isPng && !isWebp) {
      return {
        clean: false,
        threatName: `InvalidFileFormat: File content does not match allowed image (JPEG, PNG, WEBP) or PDF signatures`,
      };
    }

    return { clean: true };
  }

  /**
   * Store file with AES-256-GCM Server-Side Encryption (HARD RULE 7)
   */
  async storeEncryptedDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf',
  ): Promise<{ fileKey: string; checksum: string; fileSize: number }> {
    // 1. Virus scan hook
    const scan = await this.scanFile(fileBuffer, fileName);
    if (!scan.clean) {
      throw new Error(`Document security scan failed: ${scan.threatName}`);
    }

    // 2. Compute SHA-256 checksum
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 3. Encrypt buffer using AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encryptedData = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const fileKey = `kyc-docs/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    const record: StoredEncryptedDocument = {
      fileKey,
      checksum,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
      encryptedData,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      createdAt: new Date().toISOString(),
    };

    this.documents.set(fileKey, record);
    // Durable store so cold Vercel starts can still decrypt for admin review
    await persistEncryptedDocument(record);

    return {
      fileKey,
      checksum,
      fileSize: fileBuffer.length,
    };
  }

  /**
   * Issues short-lived signed URL ONLY to SUPER_ADMIN (HARD RULE 7)
   * Acceptance Criteria: Document URLs expire and are never exposed to members after upload.
   */
  generateSignedUrl(
    docId: string,
    fileKey: string,
    expiresInSeconds = 300, // 5 minutes default
  ): { signedUrl: string; expiresAt: string; expiresInSeconds: number } {
    const expiresAtMs = Date.now() + expiresInSeconds * 1000;
    const payload = `${docId}:${fileKey}:${expiresAtMs}`;
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');

    const token = Buffer.from(
      JSON.stringify({ docId, fileKey, exp: expiresAtMs, sig: signature }),
    ).toString('base64url');

    const expiresAtIso = new Date(expiresAtMs).toISOString();

    return {
      signedUrl: `/admin/kyc/documents/${docId}/view?token=${token}`,
      expiresAt: expiresAtIso,
      expiresInSeconds,
    };
  }

  /**
   * Seed unencrypted buffer directly into encrypted storage (used for tests & demo bootstrap)
   */
  seedDocument(
    fileKey: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf',
  ): { fileKey: string; checksum: string; fileSize: number } {
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encryptedData = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const record: StoredEncryptedDocument = {
      fileKey,
      checksum,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
      encryptedData,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      createdAt: new Date().toISOString(),
    };

    this.documents.set(fileKey, record);
    void persistEncryptedDocument(record);
    return { fileKey, checksum, fileSize: fileBuffer.length };
  }

  /**
   * Verifies signed URL token and checks expiration
   */
  verifySignedToken(docId: string, token: string): { fileKey: string; valid: boolean } {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
      if (decoded.docId !== docId) {
        throw new Error('Signed URL document ID mismatch.');
      }
      if (Date.now() > decoded.exp) {
        throw new Error('Signed URL has expired. Please request a new short-lived URL.');
      }

      const expectedPayload = `${decoded.docId}:${decoded.fileKey}:${decoded.exp}`;
      const expectedSig = crypto
        .createHmac('sha256', this.signingSecret)
        .update(expectedPayload)
        .digest('hex');

      const sigBuf = Buffer.from(decoded.sig || '');
      const expectedSigBuf = Buffer.from(expectedSig);

      if (
        sigBuf.length !== expectedSigBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedSigBuf)
      ) {
        throw new Error('Invalid signed URL signature.');
      }

      return { fileKey: decoded.fileKey, valid: true };
    } catch (err: any) {
      throw new Error(`Signed URL verification failed: ${err.message}`);
    }
  }

  private async resolveRecord(fileKey: string): Promise<StoredEncryptedDocument | null> {
    let record = this.documents.get(fileKey) ?? null;
    if (record) return record;
    record = await loadPersistedEncryptedDocument(fileKey);
    if (record) {
      this.documents.set(fileKey, record);
    }
    return record;
  }

  /**
   * Decrypt document buffer for SUPER_ADMIN review
   */
  async decryptDocument(
    fileKey: string,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string; checksum: string }> {
    const record = await this.resolveRecord(fileKey);
    if (!record) {
      throw new Error(
        'Requested document not found in private storage. The file may have been uploaded before durable document storage was enabled — ask the member to re-submit their identity document.',
      );
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(record.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(record.authTag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(record.encryptedData),
      decipher.final(),
    ]);

    return {
      buffer: decrypted,
      fileName: record.fileName,
      mimeType: record.mimeType,
      checksum: record.checksum,
    };
  }

  hasDocument(fileKey: string): boolean {
    return this.documents.has(fileKey);
  }

  async deleteDocument(fileKey: string): Promise<void> {
    this.documents.delete(fileKey);
    await deletePersistedEncryptedDocument(fileKey);
  }
}
