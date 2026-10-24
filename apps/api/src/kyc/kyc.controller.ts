import { Request, Response, NextFunction } from 'express';
import { KycService } from './kyc.service';
import { KycSubmissionStatus } from '@lumenfield/shared';

export class KycController {
  constructor(private readonly kycService: KycService) {}

  // Member: Get current KYC status
  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.kycService.ensureReady();
      const email = req.user!.email;
      const submission = this.kycService.getMemberSubmission(req.user!.id, email);
      const isApproved = this.kycService.isMemberKycApproved(req.user!.id, email);
      res.json({
        isApproved,
        submission,
        status: submission ? submission.status : isApproved ? 'APPROVED' : 'NOT_SUBMITTED',
      });
    } catch (err) {
      next(err);
    }
  };

  // Member: Submit identity documents
  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.kycService.ensureReady();
      const ip = (req.ip || '127.0.0.1').toString();
      const submission = await this.kycService.submitKyc(
        req.user!.id,
        req.user!.email, // Fallback name or from profile
        req.user!.email,
        req.body,
        ip,
        req.headers['user-agent'],
      );
      res.status(201).json(submission);
    } catch (err) {
      next(err);
    }
  };

  // Member: In-app notifications
  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notifications = this.kycService.getMemberNotifications(req.user!.id);
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  };

  markNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      this.kycService.markNotificationsRead(req.user!.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  // SUPER_ADMIN: Get Review Queue
  getQueue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.kycService.ensureReady();
      const statusFilter = req.query.status as KycSubmissionStatus | undefined;
      const queue = this.kycService.getAdminQueue(statusFilter);
      res.json(queue);
    } catch (err) {
      next(err);
    }
  };

  // SUPER_ADMIN: Get Submission details
  getSubmission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const submission = this.kycService.getSubmissionById(id);
      if (!submission) {
        res.status(404).json({ statusCode: 404, message: 'KYC submission not found.' });
        return;
      }
      res.json(submission);
    } catch (err) {
      next(err);
    }
  };

  // SUPER_ADMIN: Issue short-lived signed URL for document viewer (HARD RULE 7)
  // Acceptance Criteria: Document URLs expire and are never exposed to members after upload.
  getSignedUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { docId } = req.params;
      const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string, 10) : 300;
      const result = this.kycService.generateDocumentSignedUrl(
        docId,
        req.user!.role,
        expiresIn,
      );
      res.json(result);
    } catch (err: any) {
      if (err.message && err.message.includes('Forbidden')) {
        res.status(403).json({ statusCode: 403, message: err.message });
        return;
      }
      next(err);
    }
  };

  // View Document using signed URL token (Can be opened in <iframe> or <img> with token)
  viewDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { docId } = req.params;
      const token = req.query.token as string;
      if (!token) {
        res.status(401).json({ statusCode: 401, message: 'Unauthorized: Missing signed URL token.' });
        return;
      }

      const { buffer, mimeType, fileName, checksum } = this.kycService.viewDocumentWithSignedToken(
        docId,
        token,
      );

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('X-Document-Checksum-Sha256', checksum);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      // Short cache limit or no-cache since URL is short-lived
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.status(200).send(buffer);
    } catch (err: any) {
      res.status(403).json({
        statusCode: 403,
        message: err.message || 'Forbidden: Invalid or expired signed URL.',
      });
    }
  };

  // SUPER_ADMIN: Review decision (Approve, Reject, Request More Info)
  review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.kycService.ensureReady();
      const { id } = req.params;
      const ip = (req.ip || '127.0.0.1').toString();
      const submission = await this.kycService.reviewSubmission(
        id,
        req.body,
        req.user!.id,
        ip,
        req.headers['user-agent'],
      );
      res.json(submission);
    } catch (err) {
      next(err);
    }
  };

  // SUPER_ADMIN: Edit KYC submission
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.kycService.ensureReady();
      const { id } = req.params;
      const ip = (req.ip || '127.0.0.1').toString();
      const submission = await this.kycService.adminUpdateSubmission(
        id,
        req.body,
        req.user!.id,
        ip,
      );
      res.json(submission);
    } catch (err) {
      next(err);
    }
  };

  // SUPER_ADMIN: Delete KYC submission
  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.kycService.ensureReady();
      const { id } = req.params;
      const ip = (req.ip || '127.0.0.1').toString();
      const result = await this.kycService.deleteSubmission(id, req.user!.id, ip);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
