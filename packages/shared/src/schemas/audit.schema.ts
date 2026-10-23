import { z } from 'zod';

export const AuditActorRoleSchema = z.enum(['MEMBER', 'SUPER_ADMIN', 'SYSTEM', 'ANONYMOUS']);
export type AuditActorRole = z.infer<typeof AuditActorRoleSchema>;

export const AuditActionSchema = z.enum([
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'AUTH_ACCOUNT_LOCKED',
  'AUTH_LOGOUT',
  'AUTH_MFA_ENROLLED',
  'AUTH_MFA_DISABLED',
  'AUTH_MFA_RECOVERY_USED',
  'AUTH_PASSWORD_CHANGED',
  'AUTH_PASSWORD_RESET_REQUESTED',
  'AUTH_PASSWORD_RESET_COMPLETED',
  'AUTH_SESSION_REVOKED',
  'ADMIN_FUND_WALLET',
  'ADMIN_UPDATE_MEMBER_STATUS',
  'ADMIN_APPROVE_KYC_DOCUMENT',
  'ADMIN_REJECT_KYC_DOCUMENT',
  'ADMIN_APPROVE_LOAN',
  'ADMIN_REJECT_LOAN',
  'ADMIN_UPDATE_COUNTRY_SETTINGS',
  'ADMIN_CREATE_SUPER_USER',
  'ADMIN_REVERSAL_TRANSACTION',
  'ADMIN_CREATE_PENDING_TRANSACTION',
  'ADMIN_APPROVE_TRANSACTION',
  'ADD_BENEFICIARY',
  'MEMBER_TRANSFER_POSTED',
  'BANK_TRANSFER_INITIATED',
  'TRANSFER_FAILED_REVERSAL_POSTED',
  'ADMIN_APPROVE_FLAGGED_TRANSFER',
  'ADMIN_REJECT_FLAGGED_TRANSFER',
  'MEMBER_CREATE_VIRTUAL_CARD',
  'MEMBER_FREEZE_CARD',
  'MEMBER_UNFREEZE_CARD',
  'MEMBER_UPDATE_CARD_LIMITS',
  'CARD_PURCHASE_SIMULATED',
  'MEMBER_EXPORT_DATA',
  'MEMBER_REQUEST_DELETION',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditLogSchema = z.object({
  id: z.string().optional(),
  actorId: z.string().min(1),
  actorRole: AuditActorRoleSchema,
  action: AuditActionSchema,
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  beforeState: z.record(z.string(), z.any()).nullable().optional(),
  afterState: z.record(z.string(), z.any()).nullable().optional(),
  ipAddress: z.string().min(1),
  userAgent: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;
