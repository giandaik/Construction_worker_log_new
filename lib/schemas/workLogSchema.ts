import { z } from 'zod'

/**
 * Centralized Work Log Zod Schemas
 * Used for form validation across create and edit forms
 */

export const personnelSchema = z.object({
  role: z.string(),
  count: z.number().min(0),
  workDetails: z.string()
})

export const equipmentSchema = z.object({
  type: z.string(),
  count: z.number().min(0),
  hours: z.number().min(0)
})

export const materialSchema = z.object({
  name: z.string(),
  quantity: z.number().min(0),
  unit: z.string()
})

export const signatureSchema = z.object({
  data: z.string(),
  signedBy: z.string(),
  signedAt: z.union([z.string(), z.date()]),
  role: z.string().optional()
})

/**
 * Main Work Log schema used for form validation
 */
export const workLogSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  project: z.string().min(1, 'Project is required'),
  author: z.string().min(1, 'Author is required'),
  weather: z.string().optional(),
  temperature: z.number().optional(),
  workDescription: z.string().min(1, 'Work description is required'),
  personnel: z.array(personnelSchema).optional(),
  equipment: z.array(equipmentSchema).optional(),
  materials: z.array(materialSchema).optional(),
  notes: z.string().optional(),
  signatures: z.array(signatureSchema).optional(),
  images: z.array(z.string()).optional(),
  dwgRefs: z.array(z.string()).optional()
})

/**
 * TypeScript type inferred from the schema
 */
export type WorkLogFormData = z.infer<typeof workLogSchema>

/**
 * Default values for array fields
 */
export const DEFAULT_PERSONNEL = { role: '', count: 0, workDetails: '' }
export const DEFAULT_EQUIPMENT = { type: '', count: 0, hours: 0 }
export const DEFAULT_MATERIAL = { name: '', quantity: 0, unit: '' }
