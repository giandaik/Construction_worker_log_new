import { z } from 'zod';

export const signupRequestSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80)
    .refine((value) => !/[\r\n]/.test(value), 'First name must be on one line'),
  lastName: z.string().trim().min(1, 'Last name is required').max(80)
    .refine((value) => !/[\r\n]/.test(value), 'Last name must be on one line'),
  email: z.string().trim().toLowerCase().max(254).email('Valid email is required'),
  organizationName: z.string().trim().min(1, 'Organisation name is required').max(160),
  message: z.string().trim().max(500, 'Message must be at most 500 characters').optional(),
  website: z.string().max(200).optional(),
});

export const signupRequestDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    tenantId: z.string().trim().min(1, 'A tenant is required'),
    tenantRole: z.enum(['ADMIN', 'MANAGER', 'WORKER']),
  }),
  z.object({
    action: z.literal('reject'),
    reason: z.string().trim().max(500).optional(),
  }),
]);
