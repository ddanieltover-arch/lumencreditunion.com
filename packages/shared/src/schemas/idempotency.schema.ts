import { z } from 'zod';

export const IdempotencyKeyRecordSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(8).max(128),
  route: z.string().min(1),
  requestHash: z.string().min(1),
  responseStatus: z.number().int().optional(),
  responseBody: z.any().optional(),
  lockedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type IdempotencyKeyRecord = z.infer<typeof IdempotencyKeyRecordSchema>;
