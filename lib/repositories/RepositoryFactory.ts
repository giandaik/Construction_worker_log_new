import { DatabaseUtils } from '@/lib/api/database';
import { WorkLogRepository } from './WorkLogRepository';
import { ProjectRepository } from './ProjectRepository';
import { UserRepository } from './UserRepository';
import { TenantRepository } from './TenantRepository';
import { UserTenantMembershipRepository } from './UserTenantMembershipRepository';
import { ImpersonationLogRepository } from './ImpersonationLogRepository';
import type { RepositoryContext } from './base/RepositoryContext';

/**
 * Repository Factory
 * Provides a centralized way to access all repositories
 * Implements the Factory Pattern for repository instantiation
 */
export class RepositoryFactory {
  // --- tenant-owned collections: callers must supply an explicit context ---
  // (see lib/repositories/base/RepositoryContext.ts — there is no way to
  // construct these without deciding tenant vs. platform scope)

  static getWorkLogRepository(context: RepositoryContext): WorkLogRepository {
    const collection = DatabaseUtils.getCollection('worklogs');
    return new WorkLogRepository(collection, context);
  }

  static getProjectRepository(context: RepositoryContext): ProjectRepository {
    const collection = DatabaseUtils.getCollection('projects');
    return new ProjectRepository(collection, context);
  }

  /**
   * Get User repository instance
   */
  static getUserRepository(): UserRepository {
    const collection = DatabaseUtils.getCollection('users');
    return new UserRepository(collection);
  }

  static getTenantRepository(): TenantRepository {
    const collection = DatabaseUtils.getCollection('tenants');
    return new TenantRepository(collection);
  }

  static getMembershipRepository(): UserTenantMembershipRepository {
    const collection = DatabaseUtils.getCollection('user_tenant_memberships');
    return new UserTenantMembershipRepository(collection);
  }

  static getImpersonationLogRepository(): ImpersonationLogRepository {
    const collection = DatabaseUtils.getCollection('impersonation_logs');
    return new ImpersonationLogRepository(collection);
  }

  // --- convenience wrappers ---

  static async withRepositories<T>(
    callback: (repos: {
      workLogs: WorkLogRepository;
      projects: ProjectRepository;
      users: UserRepository;
    }) => Promise<T>,
    context: RepositoryContext
  ): Promise<T> {
    await DatabaseUtils.connect();

    const repos = {
      workLogs: this.getWorkLogRepository(context),
      projects: this.getProjectRepository(context),
      users: this.getUserRepository(),
    };

    return callback(repos);
  }

  /**
   * Execute a callback with a specific repository
   * Automatically handles database connection
   */
  static async withWorkLogRepository<T>(
    callback: (repo: WorkLogRepository) => Promise<T>,
    context: RepositoryContext
  ): Promise<T> {
    await DatabaseUtils.connect();
    const repo = this.getWorkLogRepository(context);
    return callback(repo);
  }

  static async withProjectRepository<T>(
    callback: (repo: ProjectRepository) => Promise<T>,
    context: RepositoryContext
  ): Promise<T> {
    await DatabaseUtils.connect();
    const repo = this.getProjectRepository(context);
    return callback(repo);
  }

  static async withUserRepository<T>(
    callback: (repo: UserRepository) => Promise<T>
  ): Promise<T> {
    await DatabaseUtils.connect();
    const repo = this.getUserRepository();
    return callback(repo);
  }

  static async withTenantRepository<T>(
    callback: (repo: TenantRepository) => Promise<T>
  ): Promise<T> {
    await DatabaseUtils.connect();
    return callback(this.getTenantRepository());
  }

  static async withMembershipRepository<T>(
    callback: (repo: UserTenantMembershipRepository) => Promise<T>
  ): Promise<T> {
    await DatabaseUtils.connect();
    return callback(this.getMembershipRepository());
  }

  static async withImpersonationLogRepository<T>(
    callback: (repo: ImpersonationLogRepository) => Promise<T>
  ): Promise<T> {
    await DatabaseUtils.connect();
    return callback(this.getImpersonationLogRepository());
  }
}
