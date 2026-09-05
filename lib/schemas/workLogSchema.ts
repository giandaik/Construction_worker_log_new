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

// ---------------------------------------------------------------------------
// Server-side request schemas
//
// `workLogSchema` above drives the *forms*. The two schemas below validate
// what actually arrives at POST /api/worklogs and PUT /api/worklogs/[id].
// They are `.strict()`, so an unknown key is a 400 rather than a field
// silently persisted — the mass-assignment surface reported as H2/M4.
//
// They deliberately omit `tenantId`, `_id` and `createdAt`: those are
// server-derived and a client must never be able to name them at all.
// ---------------------------------------------------------------------------

/** A Mongo ObjectId as it appears in JSON. */
const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id')

/**
 * Sub-document shapes as the client actually sends them.
 *
 * Kept looser than the form schema on purpose: the offline queue
 * (`lib/syncService.ts`) replays payloads whose rows may omit `workDetails`
 * or `hours`, and rejecting those would drop work logs captured offline.
 */
const personnelEntrySchema = z
  .object({
    role: z.string(),
    count: z.number(),
    workDetails: z.string().optional(),
  })
  .strict()

const equipmentEntrySchema = z
  .object({
    type: z.string(),
    count: z.number(),
    hours: z.number().optional(),
  })
  .strict()

const materialEntrySchema = z
  .object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
  })
  .strict()

const signatureEntrySchema = z
  .object({
    data: z.string(),
    signedBy: z.string(),
    signedAt: z.union([z.string(), z.date()]),
    projectRole: z.string().optional(),
    role: z.string().optional(),
    signedByUserId: z.string().optional(),
  })
  .strict()

/**
 * Every field a client is allowed to name on a work log.
 *
 * `status` is accepted because the forms send it, but the route recomputes it
 * from the signatures — a client value never survives.
 */
const workLogRequestFields = {
  date: z.union([z.string(), z.date()]),
  project: objectIdString,
  author: objectIdString,
  weather: z.string().optional(),
  temperature: z.number().optional(),
  workDescription: z.string(),
  personnel: z.array(personnelEntrySchema).optional(),
  equipment: z.array(equipmentEntrySchema).optional(),
  materials: z.array(materialEntrySchema).optional(),
  issues: z.string().optional(),
  notes: z.string().optional(),
  signatures: z.array(signatureEntrySchema).optional(),
  images: z.array(z.string()).optional(),
  dwgRefs: z.array(z.string()).optional(),
  status: z.string().optional(),
}

/** POST /api/worklogs — `author` is overwritten server-side from the JWT. */
export const workLogCreateSchema = z
  .object({
    ...workLogRequestFields,
    author: objectIdString.optional(),
  })
  .strict()

/**
 * PUT /api/worklogs/[id] — every field optional.
 *
 * The work log detail page approves a log by sending only
 * `{ signatures, status }`, so requiring the full document would break it.
 */
export const workLogUpdateSchema = z
  .object(workLogRequestFields)
  .partial()
  .strict()

/**
 * Default values for array fields
 */
export const DEFAULT_PERSONNEL = { role: '', count: 0, workDetails: '' }
export const DEFAULT_EQUIPMENT = { type: '', count: 0, hours: 0 }
export const DEFAULT_MATERIAL = { name: '', quantity: 0, unit: '' }
