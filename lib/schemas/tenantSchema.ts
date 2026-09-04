import { z } from 'zod';

export const tenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  status: z.enum(['active', 'disabled', 'suspended']).optional().default('active'),
  plan: z.string().optional().default('free'),
});

export const tenantUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  status: z.enum(['active', 'disabled', 'suspended']).optional(),
  plan: z.string().optional(),
});

export const membershipSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  tenantRole: z.enum(['ADMIN', 'MANAGER', 'WORKER', 'admin', 'manager', 'worker']).transform((role) => role.toUpperCase() as 'ADMIN' | 'MANAGER' | 'WORKER').default('WORKER'),
});

export const membershipUpdateSchema = z.object({
  tenantRole: z.enum(['ADMIN', 'MANAGER', 'WORKER', 'admin', 'manager', 'worker']).transform((role) => role.toUpperCase() as 'ADMIN' | 'MANAGER' | 'WORKER'),
  isActive: z.boolean().optional(),
});

export const tenantProvisioningSchema = z.object({
  name: z.string().trim().min(1, 'Tenant name is required'),
  slug: z.string().trim().toLowerCase().min(2).regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens').optional(),
  status: z.enum(['active', 'disabled', 'suspended']).optional().default('active'),
  plan: z.string().trim().min(1).optional().default('free'),
  initialAdmin: z.object({
    name: z.string().trim().min(1, 'Administrator name is required'),
    email: z.string().trim().toLowerCase().email('Valid administrator email is required'),
    password: z.string().min(8, 'Administrator password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Administrator password confirmation is required'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Administrator passwords do not match',
    path: ['confirmPassword'],
  }),
});

export type TenantFormData = z.infer<typeof tenantSchema>;
export type MembershipFormData = z.infer<typeof membershipSchema>;
