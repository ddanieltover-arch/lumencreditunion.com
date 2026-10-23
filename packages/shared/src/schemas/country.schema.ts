import { z } from 'zod';

export const IdDocumentTypeSchema = z.enum([
  'PASSPORT',
  'DRIVERS_LICENSE',
  'NATIONAL_ID',
  'STATE_ID',
  'RESIDENCE_PERMIT',
  'BRP',
  'TITRE_DE_SEJOUR',
  'DNI',
  'NIE',
  'CARTA_IDENTITA',
  'IRISH_RESIDENCE_PERMIT',
  'PROVINCIAL_ID',
]);
export type IdDocumentType = z.infer<typeof IdDocumentTypeSchema>;

export const CountrySchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().length(2).toUpperCase(),
  name: z.string().min(1),
  currency: z.enum(['USD', 'CAD', 'GBP', 'EUR']),
  currencySymbol: z.string().min(1),
  enabled: z.boolean(),
  acceptedIdTypes: z.array(IdDocumentTypeSchema),
  autoLoansEnabled: z.boolean().default(true),
  mortgageEnabled: z.boolean().default(true),
  cardsEnabled: z.boolean().default(true),
  isSanctioned: z.boolean().default(false),
  sanctionReason: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Country = z.infer<typeof CountrySchema>;

export const SanctionCheckResponseSchema = z.object({
  isSanctioned: z.boolean(),
  allowed: z.boolean(),
  countryCode: z.string(),
  reason: z.string().optional(),
});
export type SanctionCheckResponse = z.infer<typeof SanctionCheckResponseSchema>;
