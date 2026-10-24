import { Request, Response, NextFunction } from 'express';
import { KycService } from '../../kyc/kyc.service';

/**
 * Server-side KYC Verification Guard
 * Acceptance Criterion: Unverified members get a clear "verify your identity" prompt and a 403 from restricted endpoints.
 * Blocks wallet funding, transfers, cards and loan applications until member KYC status is APPROVED.
 */
export function requireKycApproved(kycService: KycService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({
          statusCode: 401,
          message: 'Unauthorized: authentication required.',
        });
        return;
      }

      // SUPER_ADMIN role bypasses member verification checks for administrative purposes
      if (user.role === 'SUPER_ADMIN') {
        next();
        return;
      }

      await kycService.ensureReady();
      const isApproved = kycService.isMemberKycApproved(user.id, user.email);
      if (!isApproved) {
        res.status(403).json({
          statusCode: 403,
          error: 'KycVerificationRequired',
          message:
            'Identity verification required. Your KYC submission is not approved. Please submit identity verification documents to access this feature.',
          actionRequired: 'VERIFY_IDENTITY',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
