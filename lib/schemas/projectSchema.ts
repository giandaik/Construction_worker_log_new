import { z } from 'zod'

/**
 * Centralized Project Zod Schema
 * Used for validation in project API routes and forms
 */
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  ownerEmail: z.string().email('Invalid owner email'),
  contractorEmail: z.string().email('Invalid contractor email'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.enum(['planned', 'in-progress', 'completed', 'on-hold']).optional(),
  manager: z.string().optional(),
})

/**
 * TypeScript type inferred from the schema
 */
export type ProjectFormData = z.infer<typeof projectSchema>

/**
 * Default project data template
 */
export const DEFAULT_PROJECT = {
  name: '',
  description: '',
  location: '',
  status: 'planned' as const,
}
