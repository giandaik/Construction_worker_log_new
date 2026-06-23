import { z } from 'zod'

export const dwgFileSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1),
  size: z.number().int().nonnegative(),
  pdfUrl: z.string().url().optional(),
  pdfFilename: z.string().min(1).optional(),
  pdfSize: z.number().int().nonnegative().optional(),
  uploadedAt: z.union([z.string(), z.date()]).optional(),
  uploadedBy: z.string().optional(),
})

export type DwgFile = z.infer<typeof dwgFileSchema>

/**
 * Centralized Project Zod Schema
 * Used for validation in project API routes and forms
 */
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  ownerEmail: z.string().email('Invalid owner email'),
  contractorEmail: z.string().email('Invalid contractor email'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.enum(['planned', 'in-progress', 'completed', 'on-hold']).optional(),
  manager: z.string().optional(),
  dwgFiles: z.array(dwgFileSchema).optional(),
})

/**
 * Schema for editing an existing project.
 * Mirrors projectSchema but coerces incoming date strings (JSON has no Date type).
 */
export const projectUpdateSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  ownerEmail: z.string().email('Invalid owner email'),
  contractorEmail: z.string().email('Invalid contractor email'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
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
