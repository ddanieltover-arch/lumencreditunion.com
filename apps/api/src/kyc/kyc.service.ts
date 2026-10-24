import crypto from 'crypto';
import {
  KycSubmission,
  KycDocument,
  SubmitKycInput,
  SubmitKycInputSchema,
  ReviewKycInput,
  ReviewKycInputSchema,
  KycSubmissionStatus,
  AdminUpdateKycInput,
  AdminUpdateKycSchema,
} from '@lumenfield/shared';
import { PrivateDocumentStorageService } from './private-document-storage.service';
import {
  SanctionsScreeningService,
  SandboxSanctionsScreeningService,
  SanctionsCheckResult,
} from './sanctions-screening.service';
import { AuditService } from '../audit/audit.service';
import { CountriesService } from '../countries/countries.service';
import { EmailService } from '../email/email.service';
import {
  loadPersistedKycSubmissions,
  persistKycSubmission,
  deletePersistedKycSubmission,
} from './kyc-persistence';

export interface MemberNotification {
  id: string;
  memberId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
}

type GlobalKyc = typeof globalThis & { __lumenKycService?: KycService };

export class KycService {
  private submissions = new Map<string, KycSubmission>(); // submissionId -> KycSubmission
  private memberSubmissionIndex = new Map<string, string>(); // memberId -> submissionId
  private emailSubmissionIndex = new Map<string, string>(); // email -> submissionId
  private documentsIndex = new Map<string, { submissionId: string; document: KycDocument }>(); // docId -> doc
  private notifications = new Map<string, MemberNotification[]>(); // memberId -> notifications[]
  public memberKycStatus = new Map<string, KycSubmissionStatus>(); // memberId -> status override or cache
  private hydratePromise: Promise<void>;

  constructor(
    private readonly storageService: PrivateDocumentStorageService = new PrivateDocumentStorageService(),
    private readonly sanctionsService: SanctionsScreeningService = new SandboxSanctionsScreeningService(),
    public readonly auditService: AuditService = new AuditService(),
    private readonly countriesService: CountriesService = new CountriesService(),
    private readonly emailService: EmailService = EmailService.getInstance(),
  ) {
    this.seedDemoSubmissions();
    this.hydratePromise = this.hydrateFromStore();
  }

  /** Process-wide singleton so warm serverless instances keep KYC state. */
  static getInstance(): KycService {
    const g = globalThis as GlobalKyc;
    if (!g.__lumenKycService) {
      g.__lumenKycService = new KycService();
    }
    return g.__lumenKycService;
  }

  async ensureReady(): Promise<void> {
    await this.hydratePromise;
  }

  private indexSubmission(submission: KycSubmission) {
    this.submissions.set(submission.id, submission);
    this.memberSubmissionIndex.set(submission.memberId, submission.id);
    this.emailSubmissionIndex.set(submission.memberEmail.toLowerCase(), submission.id);
    this.memberKycStatus.set(submission.memberId, submission.status);
    for (const doc of submission.documents || []) {
      this.documentsIndex.set(doc.id, { submissionId: submission.id, document: doc });
    }
  }

  private async hydrateFromStore() {
    try {
      const persisted = await loadPersistedKycSubmissions();
      for (const submission of persisted) {
        // Prefer durable store over demo seed for the same member
        this.indexSubmission(submission);
      }
      if (persisted.length) {
        console.log(`[KycService] Restored ${persisted.length} KYC submission(s) from database.`);
      }
    } catch (err) {
      console.error('[KycService] Hydration failed:', err);
    }
  }

  private resolveSubmissionId(memberId: string, memberEmail?: string): string | undefined {
    return (
      this.memberSubmissionIndex.get(memberId) ||
      (memberEmail ? this.emailSubmissionIndex.get(memberEmail.toLowerCase()) : undefined)
    );
  }

  /**
   * Seed demo submission for LF-000124 / Amara Okafor so queue is populated
   */
  private seedDemoSubmissions() {
    const demoMemberId = '00000000-0000-0000-0000-000000000002';
    const submissionId = 'kyc-sub-demo-001';
    const docId1 = 'doc-seed-001';

    // Seed dummy encrypted passport buffer
    const dummyPassportBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Title (US Passport) /Creator (Lumenfield Credit Union) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
    );
    const fileKey = 'kyc-docs/seed-passport-001';

    // Store in storage with the exact encryption key
    const stored = this.storageService.seedDocument(
      fileKey,
      dummyPassportBuffer,
      'us_passport_amara_okafor.pdf',
      'application/pdf',
    );

    const doc1: KycDocument = {
      id: docId1,
      submissionId,
      type: 'PASSPORT',
      fileKey,
      checksum: stored.checksum,
      fileName: 'us_passport_amara_okafor.pdf',
      fileSize: dummyPassportBuffer.length,
      mimeType: 'application/pdf',
      side: 'FRONT',
      uploadedAt: new Date(Date.now() - 3600000).toISOString(),
    };

    const submission: KycSubmission = {
      id: submissionId,
      memberId: demoMemberId,
      memberName: 'Amara Okafor',
      memberEmail: 'amara.o@lumenfield.test',
      status: 'PENDING',
      countryCode: 'US',
      documentType: 'PASSPORT',
      documents: [doc1],
      sanctionsCheckPassed: true,
      sanctionsReferenceId: 'SCR-SEED-001',
      reviewerNote: null,
      rejectionReason: null,
      reviewedById: null,
      reviewedAt: null,
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    };

    this.submissions.set(submission.id, submission);
    this.memberSubmissionIndex.set(demoMemberId, submission.id);
    this.documentsIndex.set(docId1, { submissionId, document: doc1 });
  }

  /**
   * Check if member is approved (Used by server-side verification guard)
   */
  isMemberKycApproved(memberId: string, memberEmail?: string): boolean {
    if (this.memberKycStatus.get(memberId) === 'APPROVED') {
      return true;
    }
    const subId = this.resolveSubmissionId(memberId, memberEmail);
    if (!subId) return false;
    const sub = this.submissions.get(subId);
    return sub?.status === 'APPROVED';
  }

  /**
   * Get member submission (Safe for member view: NO signed URLs or internal storage keys)
   */
  getMemberSubmission(memberId: string, memberEmail?: string): KycSubmission | null {
    const subId = this.resolveSubmissionId(memberId, memberEmail);
    if (!subId) return null;
    const sub = this.submissions.get(subId);
    if (!sub) return null;

    // Sanitize document metadata: Strip raw fileKey from member response (HARD RULE 7)
    return {
      ...sub,
      documents: sub.documents.map((d) => ({
        id: d.id,
        submissionId: d.submissionId,
        type: d.type,
        fileKey: 'private-encrypted', // Hidden from member
        checksum: d.checksum,
        fileName: d.fileName,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        side: d.side,
        uploadedAt: d.uploadedAt,
      })),
    };
  }

  /**
   * Submit KYC verification documents
   */
  async submitKyc(
    memberId: string,
    memberName: string,
    memberEmail: string,
    input: SubmitKycInput,
    ipAddress: string,
    userAgent?: string,
  ): Promise<KycSubmission> {
    const validated = SubmitKycInputSchema.parse(input);

    // 1. Verify country is supported and NOT sanctioned (HARD RULE 8)
    const sanctionCheck = await this.countriesService.checkSanction(validated.countryCode);
    if (sanctionCheck.isSanctioned || !sanctionCheck.allowed) {
      const err = new Error(
        `Identity verification is blocked: Sanctioned jurisdiction '${validated.countryCode}'. ${sanctionCheck.reason || ''}`,
      ) as any;
      err.statusCode = 400;
      throw err;
    }

    // 2. Verify country accepts this document type
    const country = await this.countriesService.findByCode(validated.countryCode);
    if (!country) {
      const err = new Error(`Country code '${validated.countryCode}' not found.`) as any;
      err.statusCode = 400;
      throw err;
    }
    if (!country.enabled) {
      const err = new Error(`Platform services are currently disabled in '${country.name}'.`) as any;
      err.statusCode = 400;
      throw err;
    }

    // 3. Run Sanctions Screening Hook
    const screeningResult: SanctionsCheckResult = await this.sanctionsService.screenApplicant(
      memberName,
      validated.countryCode,
    );
    if (screeningResult.flagged || !screeningResult.passed) {
      const err = new Error(
        `Sanctions Compliance Alert: Automated screening flagged applicant on ${screeningResult.sanctionListsChecked.join(', ')}. Details: ${screeningResult.matchedEntities.join('; ')}`,
      ) as any;
      err.statusCode = 400;
      throw err;
    }

    // 4. Encrypt and store each document file (HARD RULE 7)
    const submissionId = `kyc-sub-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const storedDocs: KycDocument[] = [];

    for (const docInput of validated.documents) {
      // Decode base64
      let rawBase64 = docInput.fileBase64;
      if (rawBase64.includes(';base64,')) {
        rawBase64 = rawBase64.split(';base64,')[1];
      }
      const buffer = Buffer.from(rawBase64, 'base64');

      if (buffer.length > 10 * 1024 * 1024) {
        const err = new Error(`File '${docInput.fileName}' exceeds the 10 MB maximum size limit.`) as any;
        err.statusCode = 400;
        throw err;
      }

      // Encrypt & store in private storage bucket
      const stored = await this.storageService.storeEncryptedDocument(
        buffer,
        docInput.fileName,
        docInput.mimeType,
      );

      const docId = `doc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const docRecord: KycDocument = {
        id: docId,
        submissionId,
        type: validated.documentType,
        fileKey: stored.fileKey,
        checksum: stored.checksum,
        fileName: docInput.fileName,
        fileSize: stored.fileSize,
        mimeType: docInput.mimeType,
        side: docInput.side || 'FRONT',
        uploadedAt: new Date().toISOString(),
      };

      storedDocs.push(docRecord);
      this.documentsIndex.set(docId, { submissionId, document: docRecord });
    }

    const now = new Date().toISOString();
    const submission: KycSubmission = {
      id: submissionId,
      memberId,
      memberName,
      memberEmail,
      status: 'PENDING',
      countryCode: validated.countryCode.toUpperCase(),
      documentType: validated.documentType,
      documents: storedDocs,
      sanctionsCheckPassed: true,
      sanctionsReferenceId: screeningResult.referenceId,
      reviewerNote: null,
      rejectionReason: null,
      reviewedById: null,
      reviewedAt: null,
      submittedAt: now,
      updatedAt: now,
    };

    this.indexSubmission(submission);
    void persistKycSubmission(submission);

    // 5. Audit Log (HARD RULE 6)
    await this.auditService.record({
      actorId: memberId,
      actorRole: 'MEMBER',
      action: 'ADMIN_UPDATE_MEMBER_STATUS',
      targetType: 'KYC_SUBMISSION',
      targetId: submissionId,
      beforeState: null,
      afterState: {
        status: 'PENDING',
        documentType: validated.documentType,
        filesCount: storedDocs.length,
        sanctionsRef: screeningResult.referenceId,
      },
      ipAddress,
      userAgent,
    });

    // 6. In-App Notification
    this.addNotification({
      memberId,
      title: 'Identity Verification Submitted',
      message: `Your ${validated.documentType} has been securely uploaded and encrypted. Our compliance team will review your credentials shortly.`,
      type: 'info',
    });

    void this.emailService.sendKycSubmittedEmail(
      memberEmail,
      memberName,
      validated.documentType,
    );
    void this.emailService.sendAdminNewKycEmail({
      memberName,
      memberEmail,
      documentType: validated.documentType,
      submissionId,
    });

    // Return safe submission (without storage keys exposed)
    return this.getMemberSubmission(memberId)!;
  }

  /**
   * SUPER_ADMIN Queue
   */
  getAdminQueue(filterStatus?: KycSubmissionStatus): KycSubmission[] {
    const all = Array.from(this.submissions.values());
    if (filterStatus) {
      return all.filter((s) => s.status === filterStatus);
    }
    return all.sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  }

  getSubmissionById(id: string): KycSubmission | null {
    return this.submissions.get(id) || null;
  }

  /**
   * Generate short-lived signed URL (HARD RULE 7: ONLY for SUPER_ADMIN)
   * Acceptance Criteria: Document URLs expire and are never exposed to members after upload.
   */
  generateDocumentSignedUrl(
    docId: string,
    actorRole: 'SUPER_ADMIN' | 'MEMBER',
    expiresInSeconds = 300,
  ): { signedUrl: string; expiresAt: string; expiresInSeconds: number } {
    if (actorRole !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: Only SUPER_ADMIN can request signed URLs for identity documents.');
    }

    const docEntry = this.documentsIndex.get(docId);
    if (!docEntry) {
      throw new Error('Document not found.');
    }

    return this.storageService.generateSignedUrl(docId, docEntry.document.fileKey, expiresInSeconds);
  }

  /**
   * Decrypt and view document using signed URL token (SUPER_ADMIN only)
   */
  viewDocumentWithSignedToken(
    docId: string,
    token: string,
  ): { buffer: Buffer; fileName: string; mimeType: string; checksum: string } {
    const { fileKey } = this.storageService.verifySignedToken(docId, token);
    return this.storageService.decryptDocument(fileKey);
  }

  /**
   * Admin Review Decision: APPROVE | REJECT | REQUEST_MORE_INFO
   */
  async reviewSubmission(
    submissionId: string,
    input: ReviewKycInput,
    adminId: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<KycSubmission> {
    const validated = ReviewKycInputSchema.parse(input);
    const submission = this.submissions.get(submissionId);
    if (!submission) {
      throw new Error('KYC submission not found.');
    }

    const beforeState = {
      status: submission.status,
      reviewerNote: submission.reviewerNote,
      rejectionReason: submission.rejectionReason,
    };

    const now = new Date().toISOString();
    submission.reviewedById = adminId;
    submission.reviewedAt = now;
    submission.updatedAt = now;

    if (validated.decision === 'APPROVE') {
      submission.status = 'APPROVED';
      submission.reviewerNote = validated.reason || 'All identity criteria verified successfully.';
      submission.rejectionReason = null;

      // In-app notification
      this.addNotification({
        memberId: submission.memberId,
        title: 'Identity Verification Approved',
        message:
          'Congratulations! Your identity credentials have been verified by an administrator. Sandbox transfers, virtual cards, loans, and wallet operations are now unlocked.',
        type: 'success',
      });

      void this.emailService.sendKycApprovedEmail(
        submission.memberEmail,
        submission.memberName,
      );

      // Audit Log
      await this.auditService.record({
        actorId: adminId,
        actorRole: 'SUPER_ADMIN',
        action: 'ADMIN_APPROVE_KYC_DOCUMENT',
        targetType: 'KYC_SUBMISSION',
        targetId: submission.id,
        beforeState,
        afterState: {
          status: 'APPROVED',
          memberId: submission.memberId,
          reviewerNote: submission.reviewerNote,
        },
        ipAddress,
        userAgent,
      });
    } else if (validated.decision === 'REJECT') {
      submission.status = 'REJECTED';
      submission.rejectionReason = validated.reason!;
      submission.reviewerNote = null;

      this.addNotification({
        memberId: submission.memberId,
        title: 'Identity Verification Declined',
        message: `Your identity verification was declined: ${validated.reason}. Please review the requirements and submit updated documentation.`,
        type: 'error',
      });

      void this.emailService.sendKycRejectedEmail(
        submission.memberEmail,
        submission.memberName,
        validated.reason!,
      );

      await this.auditService.record({
        actorId: adminId,
        actorRole: 'SUPER_ADMIN',
        action: 'ADMIN_REJECT_KYC_DOCUMENT',
        targetType: 'KYC_SUBMISSION',
        targetId: submission.id,
        beforeState,
        afterState: {
          status: 'REJECTED',
          memberId: submission.memberId,
          rejectionReason: submission.rejectionReason,
        },
        ipAddress,
        userAgent,
      });
    } else if (validated.decision === 'REQUEST_MORE_INFO') {
      submission.status = 'NEEDS_MORE_INFO';
      submission.reviewerNote = validated.reason!;

      this.addNotification({
        memberId: submission.memberId,
        title: 'Additional Identity Information Required',
        message: `Compliance review update: ${validated.reason}. Please upload the requested document to complete verification.`,
        type: 'warning',
      });

      void this.emailService.sendKycNeedsMoreInfoEmail(
        submission.memberEmail,
        submission.memberName,
        validated.reason!,
      );

      await this.auditService.record({
        actorId: adminId,
        actorRole: 'SUPER_ADMIN',
        action: 'ADMIN_UPDATE_MEMBER_STATUS',
        targetType: 'KYC_SUBMISSION',
        targetId: submission.id,
        beforeState,
        afterState: {
          status: 'NEEDS_MORE_INFO',
          memberId: submission.memberId,
          reviewerNote: submission.reviewerNote,
        },
        ipAddress,
        userAgent,
      });
    }

    this.indexSubmission(submission);
    await persistKycSubmission(submission);

    return submission;
  }

  /**
   * SUPER_ADMIN: edit KYC submission fields / status without a formal adjudication email flow.
   */
  async adminUpdateSubmission(
    submissionId: string,
    input: AdminUpdateKycInput,
    adminId: string,
    ipAddress: string,
  ): Promise<KycSubmission> {
    await this.ensureReady();
    const validated = AdminUpdateKycSchema.parse(input);
    const submission = this.submissions.get(submissionId);
    if (!submission) {
      throw new Error('KYC submission not found.');
    }

    const before = {
      memberName: submission.memberName,
      memberEmail: submission.memberEmail,
      countryCode: submission.countryCode,
      documentType: submission.documentType,
      status: submission.status,
      reviewerNote: submission.reviewerNote,
      rejectionReason: submission.rejectionReason,
    };

    // Drop old email index if email changes
    if (validated.memberEmail && validated.memberEmail.toLowerCase() !== submission.memberEmail.toLowerCase()) {
      this.emailSubmissionIndex.delete(submission.memberEmail.toLowerCase());
      submission.memberEmail = validated.memberEmail.toLowerCase();
    }
    if (validated.memberName !== undefined) submission.memberName = validated.memberName.trim();
    if (validated.countryCode !== undefined) submission.countryCode = validated.countryCode.toUpperCase();
    if (validated.documentType !== undefined) submission.documentType = validated.documentType;
    if (validated.reviewerNote !== undefined) submission.reviewerNote = validated.reviewerNote;
    if (validated.rejectionReason !== undefined) submission.rejectionReason = validated.rejectionReason;
    if (validated.status !== undefined) {
      submission.status = validated.status;
      submission.reviewedById = adminId;
      submission.reviewedAt = new Date().toISOString();
    }
    submission.updatedAt = new Date().toISOString();

    this.indexSubmission(submission);
    await persistKycSubmission(submission);

    await this.auditService.record({
      actorId: adminId,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_UPDATE_MEMBER_STATUS',
      targetType: 'KYC_SUBMISSION',
      targetId: submission.id,
      beforeState: before,
      afterState: {
        memberName: submission.memberName,
        memberEmail: submission.memberEmail,
        countryCode: submission.countryCode,
        documentType: submission.documentType,
        status: submission.status,
        reviewerNote: submission.reviewerNote,
        rejectionReason: submission.rejectionReason,
      },
      ipAddress,
    });

    return submission;
  }

  /**
   * SUPER_ADMIN: permanently remove a KYC submission (and durable store row).
   */
  async deleteSubmission(
    submissionId: string,
    adminId: string,
    ipAddress: string,
  ): Promise<{ deleted: true; submissionId: string; memberId: string }> {
    await this.ensureReady();
    const submission = this.submissions.get(submissionId);
    if (!submission) {
      throw new Error('KYC submission not found.');
    }

    for (const doc of submission.documents || []) {
      this.documentsIndex.delete(doc.id);
    }
    this.submissions.delete(submission.id);
    this.memberSubmissionIndex.delete(submission.memberId);
    this.emailSubmissionIndex.delete(submission.memberEmail.toLowerCase());
    this.memberKycStatus.delete(submission.memberId);
    await deletePersistedKycSubmission(submission.memberId);

    await this.auditService.record({
      actorId: adminId,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_UPDATE_MEMBER_STATUS',
      targetType: 'KYC_SUBMISSION',
      targetId: submissionId,
      beforeState: {
        memberId: submission.memberId,
        memberEmail: submission.memberEmail,
        status: submission.status,
      },
      afterState: { deleted: true },
      ipAddress,
    });

    return { deleted: true, submissionId, memberId: submission.memberId };
  }

  /** Remove KYC for a member (used when the member account is deleted). */
  async deleteSubmissionsForMember(memberId: string, memberEmail?: string): Promise<void> {
    await this.ensureReady();
    const sub =
      this.getMemberSubmission(memberId, memberEmail) ||
      Array.from(this.submissions.values()).find((s) => s.memberId === memberId);
    if (!sub) {
      await deletePersistedKycSubmission(memberId);
      this.memberKycStatus.delete(memberId);
      return;
    }
    for (const doc of sub.documents || []) {
      this.documentsIndex.delete(doc.id);
    }
    this.submissions.delete(sub.id);
    this.memberSubmissionIndex.delete(sub.memberId);
    this.emailSubmissionIndex.delete(sub.memberEmail.toLowerCase());
    this.memberKycStatus.delete(sub.memberId);
    await deletePersistedKycSubmission(sub.memberId);
  }

  /**
   * Notifications
   */
  addNotification(params: {
    memberId: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }): MemberNotification {
    const notif: MemberNotification = {
      id: `notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      memberId: params.memberId,
      title: params.title,
      message: params.message,
      type: params.type,
      createdAt: new Date().toISOString(),
      read: false,
    };

    const list = this.notifications.get(params.memberId) || [];
    list.unshift(notif);
    this.notifications.set(params.memberId, list);
    return notif;
  }

  getMemberNotifications(memberId: string): MemberNotification[] {
    return this.notifications.get(memberId) || [];
  }

  markNotificationsRead(memberId: string): void {
    const list = this.notifications.get(memberId) || [];
    for (const n of list) {
      n.read = true;
    }
  }
}
