import { z } from 'zod'

/**
 * Centralized User Zod Schema
 * Used for validation in user API routes and forms
 */
export const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'user', 'manager']).optional(),
})

/**
 * TypeScript type inferred from the schema
 */
export type UserFormData = z.infer<typeof userSchema>

/**
 * Default user data template
 */
export const DEFAULT_USER = {
  name: '',
  email: '',
  role: 'user' as const,
}
