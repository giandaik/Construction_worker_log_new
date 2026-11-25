/**
 * Central export point for all Mongoose models and their TypeScript interfaces
 *
 * This file serves as the single source of truth for type definitions.
 * Import models and types from here to ensure consistency across the application.
 *
 * @example
 * // Import models
 * import { WorkLog, Project, User } from '@/lib/models';
 *
 * // Import types
 * import type { IWorkLog, IProject, IUser } from '@/lib/models';
 */

// Export models
export { default as WorkLog } from './WorkLog';
export { default as Project } from './Project';
export { default as User } from './User';
export { default as Tenant } from './Tenant';
export { default as UserTenantMembership } from './UserTenantMembership';
export { default as ImpersonationLog } from './ImpersonationLog';

// Export interfaces
export type { IWorkLog } from './WorkLog';
export type { IProject } from './Project';
export type { IUser } from './User';
export type { ITenant } from './Tenant';
export type { IUserTenantMembership, TenantRole } from './UserTenantMembership';
export type { IImpersonationLog } from './ImpersonationLog';
