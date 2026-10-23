import { z } from 'zod';

export const UserRoleSchema = z.enum(['MEMBER', 'SUPER_ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Registration schema
 * - Country must be a valid 2-letter uppercase code
 * - Password: minimum 12 chars, uppercase, lowercase, number, symbol
 * - Date of birth: must be at least 18 years old
 */
export const RegisterUserSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    countryCode: z.string().length(2, 'Country code must be 2 letters').toUpperCase(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
    role: UserRoleSchema.default('MEMBER'),
  })
  .refine(
    (data) => {
      const dob = new Date(data.dateOfBirth);
      if (isNaN(dob.getTime())) return false;
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      return age >= 18;
    },
    {
      message: 'You must be at least 18 years of age to register for Lumenfield.',
      path: ['dateOfBirth'],
    },
  );
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;

export const LoginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().min(6).max(10).optional(),
});
export type LoginUserInput = z.infer<typeof LoginUserSchema>;

export const MfaEnrollConfirmSchema = z.object({
  secret: z.string().min(16),
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});
export type MfaEnrollConfirmInput = z.infer<typeof MfaEnrollConfirmSchema>;

export const MfaVerifyLoginSchema = z.object({
  mfaTicket: z.string().min(1),
  totpCode: z.string().min(6).max(10), // 6 digits or 8-10 char recovery code
});
export type MfaVerifyLoginInput = z.infer<typeof MfaVerifyLoginSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});
export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const SessionResponseSchema = z.object({
  id: z.string(),
  deviceInfo: z.string(),
  ipAddress: z.string(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.string(),
  lastActiveAt: z.string(),
  isCurrent: z.boolean(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  role: UserRoleSchema,
  countryCode: z.string(),
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  createdAt: z.string(),
  memberProfile: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      countryCode: z.string(),
      status: z.enum(['PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED']),
    })
    .nullable()
    .optional(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;
