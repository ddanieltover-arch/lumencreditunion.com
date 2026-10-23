import { z } from 'zod';

export const KycDocumentTypeSchema = z.enum([
  'PASSPORT',
  'ID_CARD',
  'RESIDENCE_PERMIT',
  'DRIVERS_LICENSE',
]);
export type KycDocumentType = z.infer<typeof KycDocumentTypeSchema>;

export const KycSubmissionStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'NEEDS_MORE_INFO',
]);
export type KycSubmissionStatus = z.infer<typeof KycSubmissionStatusSchema>;

export const KycDocumentSideSchema = z.enum(['FRONT', 'BACK', 'COMBINED']);
export type KycDocumentSide = z.infer<typeof KycDocumentSideSchema>;

export const KycDocumentSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  type: KycDocumentTypeSchema,
  fileKey: z.string(),
  checksum: z.string(), // SHA-256
  fileName: z.string(),
  fileSize: z.number().int().max(10 * 1024 * 1024, 'Document must not exceed 10 MB'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  side: KycDocumentSideSchema.default('FRONT'),
  uploadedAt: z.string(),
});
export type KycDocument = z.infer<typeof KycDocumentSchema>;

export const KycSubmissionSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  memberName: z.string(),
  memberEmail: z.string(),
  status: KycSubmissionStatusSchema,
  countryCode: z.string().length(2),
  documentType: KycDocumentTypeSchema,
  documents: z.array(KycDocumentSchema),
  sanctionsCheckPassed: z.boolean().default(true),
  sanctionsReferenceId: z.string().optional(),
  reviewerNote: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  reviewedById: z.string().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  submittedAt: z.string(),
  updatedAt: z.string(),
});
export type KycSubmission = z.infer<typeof KycSubmissionSchema>;

export const SubmitKycInputSchema = z.object({
  countryCode: z.string().length(2),
  documentType: KycDocumentTypeSchema,
  documents: z
    .array(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
        fileBase64: z.string().min(1), // Base64 data (raw or data URL)
        side: KycDocumentSideSchema.default('FRONT'),
      }),
    )
    .min(1, 'At least one document file is required'),
});
export type SubmitKycInput = z.infer<typeof SubmitKycInputSchema>;

export const ReviewKycInputSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_MORE_INFO']),
    reason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.decision === 'REJECT' || data.decision === 'REQUEST_MORE_INFO') {
        return !!data.reason && data.reason.trim().length >= 3;
      }
      return true;
    },
    {
      message: 'Reason is required when declining or requesting more information',
      path: ['reason'],
    },
  );
export type ReviewKycInput = z.infer<typeof ReviewKycInputSchema>;
