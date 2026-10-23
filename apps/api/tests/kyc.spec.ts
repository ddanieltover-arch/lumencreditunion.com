import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApiApp } from '../src/app.module';
import { KycService } from '../src/kyc/kyc.service';
import { PrivateDocumentStorageService } from '../src/kyc/private-document-storage.service';
import { SandboxSanctionsScreeningService } from '../src/kyc/sanctions-screening.service';
import { AuditService } from '../src/audit/audit.service';
import { CountriesService } from '../src/countries/countries.service';
import { signAccessToken } from '../src/auth/jwt.util';
import { ConfigService } from '../src/config/config.service';
import http from 'http';

describe('Acceptance Criteria: Identity Verification (KYC), Document Storage, and Admin Review', () => {
  let app: ReturnType<typeof createApiApp>;
  let server: http.Server;
  let baseUrl: string;
  let storageService: PrivateDocumentStorageService;
  let sanctionsService: SandboxSanctionsScreeningService;
  let auditService: AuditService;
  let countriesService: CountriesService;
  let kycService: KycService;
  const config = ConfigService.getInstance();
  const jwtSecret = config.get('JWT_SECRET');

  const memberId = 'member-test-kyc-101';
  const adminId = '00000000-0000-0000-0000-000000000001';

  let memberToken: string;
  let adminToken: string;

  beforeEach(async () => {
    storageService = new PrivateDocumentStorageService();
    sanctionsService = new SandboxSanctionsScreeningService();
    auditService = new AuditService();
    countriesService = new CountriesService();
    kycService = new KycService(storageService, sanctionsService, auditService, countriesService);

    app = createApiApp(undefined, undefined, kycService);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    memberToken = signAccessToken(
      {
        sub: memberId,
        email: 'member.kyc@lumenfield.test',
        role: 'MEMBER',
        sessionId: 'session-member-kyc-1',
      },
      jwtSecret,
      '15m',
    );

    adminToken = signAccessToken(
      {
        sub: adminId,
        email: 'admin@lumenfield.internal',
        role: 'SUPER_ADMIN',
        sessionId: 'session-admin-1',
      },
      jwtSecret,
      '15m',
    );
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('ACCEPTANCE CRITERION: Unverified members get clear prompt and 403 on restricted operations', () => {
    it('blocks /wallet/fund with 403 and KycVerificationRequired error before KYC is approved', async () => {
      const res = await fetch(`${baseUrl}/wallet/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({ amountMinor: 50000, currency: 'USD' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('KycVerificationRequired');
      expect(data.actionRequired).toBe('VERIFY_IDENTITY');
      expect(data.message).toMatch(/Identity verification required/i);
    });

    it('blocks /transfers with 403 and prompt to verify identity', async () => {
      const res = await fetch(`${baseUrl}/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({ recipient: 'LF-000125', amountMinor: 2500, currency: 'USD' }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('KycVerificationRequired');
      expect(data.actionRequired).toBe('VERIFY_IDENTITY');
    });

    it('blocks virtual card toggle-freeze and limits with 403', async () => {
      const resFreeze = await fetch(`${baseUrl}/cards/toggle-freeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
      });
      expect(resFreeze.status).toBe(403);

      const resLimits = await fetch(`${baseUrl}/cards/limits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({ dailyLimit: 1000, monthlyLimit: 5000 }),
      });
      expect(resLimits.status).toBe(403);
    });

    it('blocks /loans/apply with 403', async () => {
      const res = await fetch(`${baseUrl}/loans/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          type: 'auto',
          amountMinor: 1500000,
          currency: 'USD',
          termMonths: 48,
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('KycVerificationRequired');
    });
  });

  describe('ACCEPTANCE CRITERION: Private Encrypted Storage & Document URLs Expire / Never Exposed to Member', () => {
    it('member uploads passport document; raw storage key is never exposed to member', async () => {
      // Create valid sample PDF
      const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Passport Test Scan) >>\nendobj\n%%EOF');
      const base64Pdf = samplePdf.toString('base64');

      const submitRes = await fetch(`${baseUrl}/kyc/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          countryCode: 'US',
          documentType: 'PASSPORT',
          documents: [
            {
              fileName: 'us_passport_front.pdf',
              mimeType: 'application/pdf',
              fileBase64: base64Pdf,
              side: 'FRONT',
            },
          ],
        }),
      });

      expect(submitRes.status).toBe(201);
      const submission = await submitRes.json();
      expect(submission.status).toBe('PENDING');
      expect(submission.countryCode).toBe('US');
      expect(submission.documents).toHaveLength(1);
      // HARD RULE 7: Document fileKey is hidden/masked in member response
      expect(submission.documents[0].fileKey).toBe('private-encrypted');
      expect(submission.documents[0].checksum).toBeDefined();

      // Check member status endpoint also masks file key
      const statusRes = await fetch(`${baseUrl}/kyc/status`, {
        headers: { Authorization: `Bearer ${memberToken}` },
      });
      const statusData = await statusRes.json();
      expect(statusData.isApproved).toBe(false);
      expect(statusData.submission.documents[0].fileKey).toBe('private-encrypted');
    });

    it('rejects member attempts to generate signed URLs for documents (403 Forbidden)', async () => {
      const memberCannotRequestSignedUrl = await fetch(
        `${baseUrl}/admin/kyc/documents/doc-seed-001/signed-url`,
        {
          headers: { Authorization: `Bearer ${memberToken}` },
        },
      );
      // Member is blocked by RolesGuard
      expect(memberCannotRequestSignedUrl.status).toBe(403);
    });

    it('SUPER_ADMIN can generate short-lived signed URLs, decrypt and view document', async () => {
      const urlRes = await fetch(
        `${baseUrl}/admin/kyc/documents/doc-seed-001/signed-url?expiresIn=300`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
      expect(urlRes.status).toBe(200);
      const urlData = await urlRes.json();
      expect(urlData.signedUrl).toContain('/admin/kyc/documents/doc-seed-001/view?token=');
      expect(urlData.expiresInSeconds).toBe(300);
      expect(urlData.expiresAt).toBeDefined();

      // Fetch the document using the signed URL
      const viewRes = await fetch(`${baseUrl}${urlData.signedUrl}`);
      expect(viewRes.status).toBe(200);
      expect(viewRes.headers.get('content-type')).toBe('application/pdf');
      expect(viewRes.headers.get('x-document-checksum-sha256')).toBeDefined();
      const content = await viewRes.text();
      expect(content).toContain('%PDF-1.4');
    });

    it('signed URLs expire and reject expired tokens', async () => {
      // Generate a signed URL that expires immediately (expiresInSeconds = -1)
      const expiredSignedUrl = storageService.generateSignedUrl('doc-seed-001', 'kyc-docs/seed-passport-001', -5);
      const viewRes = await fetch(`${baseUrl}${expiredSignedUrl.signedUrl}`);
      expect(viewRes.status).toBe(403);
      const errorData = await viewRes.json();
      expect(errorData.message).toMatch(/expired/i);
    });

    it('rejects tampered or invalid signatures on signed URL', async () => {
      const valid = storageService.generateSignedUrl('doc-seed-001', 'kyc-docs/seed-passport-001', 300);
      const tamperedUrl = valid.signedUrl + 'tampered';
      const viewRes = await fetch(`${baseUrl}${tamperedUrl}`);
      expect(viewRes.status).toBe(403);
    });
  });

  describe('Virus scan and file format validation hook', () => {
    it('rejects files containing EICAR test signature with security alert', async () => {
      const eicarBuffer = Buffer.from(
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      );
      const scan = await storageService.scanFile(eicarBuffer, 'passport_malware_test.pdf');
      expect(scan.clean).toBe(false);
      expect(scan.threatName).toContain('EICAR');
    });

    it('rejects files without valid PDF or image magic bytes', async () => {
      const badBuffer = Buffer.from('NOT_A_VALID_MAGIC_BYTE_HEADER');
      const scan = await storageService.scanFile(badBuffer, 'fake.pdf');
      expect(scan.clean).toBe(false);
      expect(scan.threatName).toContain('InvalidFileFormat');
    });
  });

  describe('Sanctions Screening Service (HARD RULE 8)', () => {
    it('blocks applicant from comprehensively sanctioned country (e.g. CU, IR, KP, SY)', async () => {
      const samplePdf = Buffer.from('%PDF-1.4\nSample passport header\n%%EOF');
      const res = await fetch(`${baseUrl}/kyc/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          countryCode: 'IR', // Iran - Sanctioned
          documentType: 'PASSPORT',
          documents: [
            {
              fileName: 'ir_passport.pdf',
              mimeType: 'application/pdf',
              fileBase64: samplePdf.toString('base64'),
              side: 'FRONT',
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toMatch(/sanctioned jurisdiction/i);
    });

    it('screening service identifies simulated watchlist hits', async () => {
      const result = await sanctionsService.screenApplicant('Osama Test Applicant', 'US');
      expect(result.passed).toBe(false);
      expect(result.flagged).toBe(true);
      expect(result.matchedEntities[0]).toContain('Watchlist');
    });
  });

  describe('Admin Review Queue, Decisions, Audit Logs, and Unlocking Member Access', () => {
    it('SUPER_ADMIN approves KYC submission -> writes audit log, in-app notification, and unlocks member operations', async () => {
      // 1. Check queue has pending submission
      const queueRes = await fetch(`${baseUrl}/admin/kyc/queue?status=PENDING`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(queueRes.status).toBe(200);
      const queue = await queueRes.json();
      expect(queue.length).toBeGreaterThanOrEqual(1);

      const targetSubmission = queue[0];
      const targetMemberId = targetSubmission.memberId;

      // 2. Admin APPROVES submission
      const reviewRes = await fetch(`${baseUrl}/admin/kyc/submissions/${targetSubmission.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'APPROVE',
          reason: 'Passport biometric page and checksum fully verified.',
        }),
      });

      expect(reviewRes.status).toBe(200);
      const approvedSubmission = await reviewRes.json();
      expect(approvedSubmission.status).toBe('APPROVED');
      expect(approvedSubmission.reviewedById).toBe(adminId);

      // 3. Verify audit log was recorded
      const logsRes = await fetch(`${baseUrl}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const logs = await logsRes.json();
      const kycAudit = logs.find(
        (l: any) =>
          l.action === 'ADMIN_APPROVE_KYC_DOCUMENT' && l.targetId === targetSubmission.id,
      );
      expect(kycAudit).toBeDefined();
      expect(kycAudit.actorRole).toBe('SUPER_ADMIN');

      // 4. Verify in-app notification was dispatched to member
      const approvedMemberToken = signAccessToken(
        {
          sub: targetMemberId,
          email: targetSubmission.memberEmail,
          role: 'MEMBER',
          sessionId: 'session-target-member-1',
        },
        jwtSecret,
        '15m',
      );

      const notifRes = await fetch(`${baseUrl}/kyc/notifications`, {
        headers: { Authorization: `Bearer ${approvedMemberToken}` },
      });
      expect(notifRes.status).toBe(200);
      const notifications = await notifRes.json();
      expect(notifications.some((n: any) => n.title.includes('Approved'))).toBe(true);

      // 5. Verify member is now UNLOCKED from restricted endpoints
      const fundRes = await fetch(`${baseUrl}/wallet/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${approvedMemberToken}`,
        },
        body: JSON.stringify({ amountMinor: 25000, currency: 'USD' }),
      });
      expect(fundRes.status).toBe(200);

      const transferRes = await fetch(`${baseUrl}/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${approvedMemberToken}`,
        },
        body: JSON.stringify({ recipient: 'LF-000199', amountMinor: 1000, currency: 'USD' }),
      });
      expect(transferRes.status).toBe(200);
    });

    it('SUPER_ADMIN rejects KYC submission with mandatory reason -> writes audit log and notification', async () => {
      // Rejection requires reason
      const badReviewRes = await fetch(`${baseUrl}/admin/kyc/submissions/kyc-sub-demo-001/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'REJECT',
          // missing reason
        }),
      });
      expect(badReviewRes.status).toBe(400);

      const validRejectRes = await fetch(`${baseUrl}/admin/kyc/submissions/kyc-sub-demo-001/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'REJECT',
          reason: 'Passport expired 3 months prior to submission date.',
        }),
      });

      expect(validRejectRes.status).toBe(200);
      const rejected = await validRejectRes.json();
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toContain('expired');
    });

    it('SUPER_ADMIN requests more info -> sets status to NEEDS_MORE_INFO', async () => {
      const moreInfoRes = await fetch(`${baseUrl}/admin/kyc/submissions/kyc-sub-demo-001/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'REQUEST_MORE_INFO',
          reason: 'Please upload the reverse side showing machine-readable zone (MRZ).',
        }),
      });

      expect(moreInfoRes.status).toBe(200);
      const moreInfo = await moreInfoRes.json();
      expect(moreInfo.status).toBe('NEEDS_MORE_INFO');
      expect(moreInfo.reviewerNote).toContain('machine-readable zone');
    });
  });
});
