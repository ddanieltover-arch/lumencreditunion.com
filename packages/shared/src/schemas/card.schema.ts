import { z } from 'zod';

export const CardCurrencySchema = z.enum(['USD', 'CAD', 'GBP', 'EUR']);
export type CardCurrency = z.infer<typeof CardCurrencySchema>;

export const CardStatusSchema = z.enum(['ACTIVE', 'FROZEN', 'TERMINATED']);
export type CardStatus = z.infer<typeof CardStatusSchema>;

export const CreateCardSchema = z.object({
  currency: CardCurrencySchema,
  cardholderName: z.string().min(2).max(100).optional(),
  dailyLimitMinor: z
    .number()
    .int()
    .positive('Daily limit must be a positive integer in minor units')
    .optional(),
  monthlyLimitMinor: z
    .number()
    .int()
    .positive('Monthly limit must be a positive integer in minor units')
    .optional(),
});
export type CreateCardInput = z.infer<typeof CreateCardSchema>;

export const UpdateCardLimitsSchema = z
  .object({
    dailyLimitMinor: z
      .number()
      .int()
      .positive('Daily limit must be a positive integer in minor units'),
    monthlyLimitMinor: z
      .number()
      .int()
      .positive('Monthly limit must be a positive integer in minor units'),
  })
  .refine((data) => data.dailyLimitMinor <= data.monthlyLimitMinor, {
    message: 'Daily limit cannot exceed monthly limit',
    path: ['dailyLimitMinor'],
  });
export type UpdateCardLimitsInput = z.infer<typeof UpdateCardLimitsSchema>;

export const UpdateCardStatusSchema = z.object({
  status: CardStatusSchema,
  reason: z.string().max(255).optional(),
});
export type UpdateCardStatusInput = z.infer<typeof UpdateCardStatusSchema>;

export const SimulateCardPurchaseSchema = z.object({
  amountMinor: z
    .number()
    .int()
    .positive('Purchase amount must be a positive integer in minor units'),
  merchantName: z.string().min(1, 'Merchant name is required').max(120),
  merchantCategory: z.string().max(60).optional(),
  currency: CardCurrencySchema.optional(),
  idempotencyKey: z.string().min(6).max(128).optional(),
});
export type SimulateCardPurchaseInput = z.infer<typeof SimulateCardPurchaseSchema>;

export interface CardOneTimeSensitiveDetails {
  fullPan: string; // Fake non-routable test PAN, e.g. "4000 0012 3456 7890"
  cvv: string; // 3-digit test CVV
  expiry: string; // MM/YY
  warningNotice: string;
}

export interface VirtualCardRecord {
  id: string;
  memberId: string;
  cardToken: string;
  lastFour: string;
  maskedPan: string; // e.g. "•••• •••• •••• 7890"
  brand: string; // "Lumenfield Test Visa"
  currency: CardCurrency;
  status: CardStatus;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  expiryFormatted: string; // "MM/YY"
  dailyLimitMinor: number;
  monthlyLimitMinor: number;
  spentTodayMinor: number;
  spentThisMonthMinor: number;
  isVirtual: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CardCreationResponse {
  card: VirtualCardRecord;
  oneTimeCredentials: CardOneTimeSensitiveDetails;
}

export interface CardTransactionRecord {
  id: string;
  cardId: string;
  memberId: string;
  amountMinor: number;
  currency: CardCurrency;
  merchantName: string;
  merchantCategory: string;
  status: 'APPROVED' | 'DECLINED';
  declineReason?: string;
  ledgerTransactionId?: string;
  idempotencyKey: string;
  createdAt: string;
}
