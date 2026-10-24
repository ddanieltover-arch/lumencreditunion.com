import { z } from 'zod';

export const AccountTypeSchema = z.enum([
  'MEMBER_WALLET',
  'SANDBOX_FUNDING_POOL',
  'FEE',
  'LOAN_RECEIVABLE',
  'EXTERNAL_CLEARING',
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
]);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const EntryDirectionSchema = z.enum(['DEBIT', 'CREDIT']);
export type EntryDirection = z.infer<typeof EntryDirectionSchema>;

export const TransactionStatusSchema = z.enum(['POSTED', 'VOIDED', 'PENDING_APPROVAL']);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const TransactionSourceSchema = z.enum([
  'TEST', // Used for sandbox admin funding while SANDBOX_MODE=true
  'BANK', // Production deposit from connected bank
  'CRYPTO', // External crypto clearing
  'DEPOSIT', // Production-only funding, requires deposit reference & second approver
  'TRANSFER', // Peer-to-peer or internal transfer
  'LOAN_DISBURSEMENT',
  'CARD_PURCHASE',
  'FEE',
  'REVERSAL', // Corrections must be new reversing entries
]);
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;

export const LedgerEntryInputSchema = z.object({
  accountId: z.string().min(1),
  accountType: AccountTypeSchema.optional().default('MEMBER_WALLET'),
  direction: EntryDirectionSchema,
  amountMinor: z.number().int().positive('Entry amount must be a positive integer in minor units'),
  currency: z.enum(['USD', 'CAD', 'GBP', 'EUR']),
});
export type LedgerEntryInput = z.infer<typeof LedgerEntryInputSchema>;

export const PostLedgerTransactionSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(128),
    reference: z.string().min(3).max(64),
    description: z.string().min(3).max(255),
    transactionType: z.string().optional().default('GENERAL'),
    currency: z.enum(['USD', 'CAD', 'GBP', 'EUR']),
    source: TransactionSourceSchema,
    depositReference: z.string().optional(), // Required if source=DEPOSIT/BANK in PRODUCTION_MODE
    secondApprovedByUserId: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    entries: z.array(LedgerEntryInputSchema).min(2, 'Double entry ledger requires at least 2 entries'),
  })
  .refine(
    (tx) => {
      // Validate double-entry invariant: sum(debits) must equal sum(credits)
      let debits = 0;
      let credits = 0;
      for (const entry of tx.entries) {
        if (entry.currency !== tx.currency) return false;
        if (entry.direction === 'DEBIT') debits += entry.amountMinor;
        if (entry.direction === 'CREDIT') credits += entry.amountMinor;
      }
      return debits === credits;
    },
    {
      message: 'Ledger transaction is out of balance: total debits must equal total credits.',
      path: ['entries'],
    },
  );
export type PostLedgerTransactionInput = z.input<typeof PostLedgerTransactionSchema>;

export const AdminFundWalletSchema = z.object({
  memberId: z.string().min(1, 'memberId is required'),
  amountMinor: z.number().int().positive('Amount must be positive integer minor units').optional(),
  amount: z.union([z.number(), z.string()]).optional(), // Accepts decimal amount string/number
  currency: z.enum(['USD', 'CAD', 'GBP', 'EUR']),
  reason: z.string().min(3).max(255),
  idempotencyKey: z.string().min(6).optional(),
  reference: z.string().optional(),
  source: z.string().optional(), // e.g. TEST, BANK, CRYPTO
  depositReference: z.string().optional(),
  confirmed: z.boolean().optional(),
});
export type AdminFundWalletInput = z.infer<typeof AdminFundWalletSchema>;

/** Member-initiated request for wallet funding (admin credits after review). */
export const CreateFundingRequestSchema = z.object({
  amount: z.union([z.number(), z.string().min(1)]),
  currency: z.enum(['USD', 'CAD', 'GBP', 'EUR']),
  reason: z.string().trim().min(5, 'Please describe why you need funding').max(500),
  sourceHint: z
    .enum(['BANK_TRANSFER', 'WIRE', 'CARD', 'OTHER'])
    .optional()
    .default('BANK_TRANSFER'),
});
export type CreateFundingRequestInput = z.infer<typeof CreateFundingRequestSchema>;

export const ReviewFundingRequestSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    note: z.string().max(500).optional(),
  })
  .refine(
    (data) =>
      data.decision === 'APPROVE' || (!!data.note && data.note.trim().length >= 3),
    { message: 'A note is required when rejecting a funding request', path: ['note'] },
  );
export type ReviewFundingRequestInput = z.infer<typeof ReviewFundingRequestSchema>;

export const WalletTransferSchema = z.object({
  recipientMemberId: z.string().min(1, 'recipientMemberId is required'),
  amountMinor: z.number().int().positive('Amount must be positive integer minor units'),
  currency: z.enum(['USD', 'CAD', 'GBP', 'EUR']),
  note: z.string().max(255).optional(),
  idempotencyKey: z.string().min(6),
});
export type WalletTransferInput = z.infer<typeof WalletTransferSchema>;

export const WalletTransactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(10),
  currency: z.enum(['USD', 'CAD', 'GBP', 'EUR']).optional(),
  direction: z.enum(['DEBIT', 'CREDIT', 'ALL']).optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type WalletTransactionQuery = z.infer<typeof WalletTransactionQuerySchema>;

