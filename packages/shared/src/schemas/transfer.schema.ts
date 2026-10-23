import { z } from 'zod';
import { SupportedCurrencySchema } from '../money';
export type { SupportedCurrency } from '../money';

export const TransferTypeSchema = z.enum(['MEMBER_TO_MEMBER', 'BANK_PAYOUT', 'CRYPTO_WITHDRAWAL', 'CRYPTO_DEPOSIT']);
export type TransferType = z.infer<typeof TransferTypeSchema>;

export const TransferStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'FLAGGED']);
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

export const CryptoNetworkSchema = z.enum(['BTC', 'ETH', 'SOL', 'USDC_SEPOLIA']);
export type CryptoNetwork = z.infer<typeof CryptoNetworkSchema>;

// Country-specific bank account details
export const UsAccountDetailsSchema = z.object({
  routingNumber: z.string().regex(/^\d{9}$/, 'ABA Routing number must be exactly 9 digits'),
  accountNumber: z.string().min(4).max(17, 'Account number must be between 4 and 17 digits'),
  accountType: z.enum(['CHECKING', 'SAVINGS']).default('CHECKING'),
});

export const CaAccountDetailsSchema = z.object({
  institutionNumber: z.string().regex(/^\d{3}$/, 'Institution number must be 3 digits'),
  transitNumber: z.string().regex(/^\d{5}$/, 'Transit number must be 5 digits'),
  accountNumber: z.string().min(7).max(12, 'Account number must be between 7 and 12 digits'),
});

export const GbAccountDetailsSchema = z.object({
  sortCode: z
    .string()
    .transform((val) => val.replace(/[^0-9]/g, ''))
    .refine((val) => val.length === 6, 'UK Sort Code must be 6 digits (e.g. 12-34-56)'),
  accountNumber: z.string().regex(/^\d{8}$/, 'UK Account number must be exactly 8 digits'),
});

export const EuAccountDetailsSchema = z.object({
  iban: z
    .string()
    .transform((val) => val.replace(/\s+/g, '').toUpperCase())
    .refine(
      (val) => /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(val),
      'Invalid IBAN format: must start with 2-letter country code, 2 check digits, and up to 30 characters',
    ),
  bic: z.string().optional(),
});

export const AddBeneficiarySchema = z.object({
  name: z.string().min(2, 'Beneficiary legal name is required').max(100),
  countryCode: z.string().min(2).max(2).toUpperCase(),
  currency: SupportedCurrencySchema,
  details: z.record(z.string(), z.any()),
}).superRefine((data, ctx) => {
  const c = data.countryCode;
  if (c === 'US') {
    const res = UsAccountDetailsSchema.safeParse(data.details);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ['details', ...issue.path] });
      }
    }
  } else if (c === 'CA') {
    const res = CaAccountDetailsSchema.safeParse(data.details);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ['details', ...issue.path] });
      }
    }
  } else if (c === 'GB') {
    const res = GbAccountDetailsSchema.safeParse(data.details);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ['details', ...issue.path] });
      }
    }
  } else {
    // European countries / default to IBAN
    const res = EuAccountDetailsSchema.safeParse(data.details);
    if (!res.success) {
      for (const issue of res.error.issues) {
        ctx.addIssue({ ...issue, path: ['details', ...issue.path] });
      }
    }
  }
});
export type AddBeneficiaryInput = z.infer<typeof AddBeneficiarySchema>;

export const RecipientLookupSchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters'),
});
export type RecipientLookupInput = z.infer<typeof RecipientLookupSchema>;

export const MemberTransferInputSchema = z.object({
  recipientQuery: z.string().min(1, 'Recipient ID or email is required'),
  amountMinor: z.number().int().positive('Transfer amount must be a positive integer in minor units'),
  currency: SupportedCurrencySchema,
  note: z.string().max(255).optional(),
  idempotencyKey: z.string().min(8, 'Idempotency key must be at least 8 characters').max(128),
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional(),
});
export type MemberTransferInput = z.infer<typeof MemberTransferInputSchema>;

export const BankTransferInputSchema = z.object({
  beneficiaryId: z.string().min(1, 'Beneficiary ID is required'),
  amountMinor: z.number().int().positive('Bank payout amount must be a positive integer in minor units'),
  currency: SupportedCurrencySchema,
  note: z.string().max(255).optional(),
  idempotencyKey: z.string().min(8, 'Idempotency key must be at least 8 characters').max(128),
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional(),
  simulateFailure: z.boolean().optional(), // Test harness helper
});
export type BankTransferInput = z.infer<typeof BankTransferInputSchema>;

export const CryptoTransferInputSchema = z.object({
  network: CryptoNetworkSchema,
  destinationAddress: z.string().min(8, 'Destination address is required').max(128),
  amountMinor: z.number().int().positive('Crypto transfer amount must be a positive integer in minor units'),
  currency: SupportedCurrencySchema,
  idempotencyKey: z.string().min(8, 'Idempotency key must be at least 8 characters').max(128),
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional(),
});
export type CryptoTransferInput = z.infer<typeof CryptoTransferInputSchema>;

export const TransferFilterQuerySchema = z.object({
  type: TransferTypeSchema.optional(),
  status: TransferStatusSchema.optional(),
  currency: SupportedCurrencySchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type TransferFilterQuery = z.infer<typeof TransferFilterQuerySchema>;
