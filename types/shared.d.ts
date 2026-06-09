/**
 * Shared type definitions used across the application
 * Centralizes common interfaces to maintain consistency
 *
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for type definitions.
 * All other files should import from here, never redefine types.
 */

import type { ObjectId } from 'mongoose';

/**
 * Personnel entry in work logs
 */
export interface Personnel {
  role: string;
  count: number;
}

/**
 * Equipment entry in work logs
 */
export interface Equipment {
  type: string;
  count: number;
  hours?: number;
}

/**
 * Material entry in work logs
 */
export interface Material {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * Signature interface for e-signatures
 */
export interface Signature {
  data: string; // Base64 encoded image data
  signedBy: string; // Name of person who signed
  signedAt: Date | string; // Timestamp of signature
  role?: string; // Role of signer (e.g., "Supervisor", "Worker")
}

/**
 * Base WorkLog interface - used for database documents
 * Contains all fields as they exist in MongoDB
 */
export interface WorkLog {
  _id: ObjectId | string;
  date: Date;
  project: ObjectId | string;
  author: ObjectId | string;
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel: Personnel[];
  equipment: Equipment[];
  materials: Material[];
  notes?: string;
  signatures?: Signature[]; // E-signatures from workers, supervisors, etc.
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * WorkLog for API responses (serialized)
 * All ObjectIds converted to strings, dates to ISO strings
 */
export interface WorkLogDTO {
  _id: string;
  date: string;
  project: string;
  author: string;
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel: Personnel[];
  equipment: Equipment[];
  materials: Material[];
  notes?: string;
  signatures?: Signature[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * WorkLog creation input (from forms)
 * Required fields only, no generated fields
 */
export interface CreateWorkLogInput {
  date: Date | string;
  project: ObjectId | string;
  author: ObjectId | string;
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel?: Personnel[];
  equipment?: Equipment[];
  materials?: Material[];
  notes?: string;
  signatures?: Signature[];
}

/**
 * WorkLog update input (partial updates)
 */
export type UpdateWorkLogInput = Partial<Omit<CreateWorkLogInput, 'author'>>;

/**
 * Project interface
 */
export interface Project {
  _id: ObjectId | string;
  name: string;
  description?: string;
  location?: string;
  ownerName?: string;
  contractorName?: string;
  status?: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  startDate?: Date;
  endDate?: Date;
  manager?: ObjectId | string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User interface
 */
export interface User {
  _id: ObjectId | string;
  name: string;
  email: string;
  role?: 'admin' | 'manager' | 'worker';
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}
