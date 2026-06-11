import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';
import { hash } from 'bcryptjs';
import { BaseRepository } from './base/BaseRepository';
import type { FindOptions } from './base/IRepository';

/**
 * User role enum
 */
export type UserRole = 'admin' | 'user' | 'manager';

/**
 * User entity interface
 */
export interface User {
  _id?: string | ObjectId;
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User Repository
 * Handles all database operations for users
 */
export class UserRepository extends BaseRepository<User> {
  constructor(collection: any) {
    super(collection);
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email } as any);
  }

  /**
   * Check if email is already in use
   */
  async isEmailTaken(email: string, excludeUserId?: string | ObjectId): Promise<boolean> {
    const filter: any = { email };

    if (excludeUserId) {
      const objectId = typeof excludeUserId === 'string'
        ? new ObjectId(excludeUserId)
        : excludeUserId;
      filter._id = { $ne: objectId };
    }

    return this.exists(filter);
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole, options: FindOptions = {}): Promise<User[]> {
    return this.findAll(
      { role } as any,
      {
        sort: { name: 1 },
        ...options,
      }
    );
  }

  /**
   * Get users summary (lightweight for dropdowns)
   */
  async findSummary(): Promise<Pick<User, '_id' | 'name' | 'email' | 'role'>[]> {
    const documents = await this.collection
      .find({})
      .project({ _id: 1, name: 1, email: 1, role: 1 })
      .sort({ name: 1 })
      .toArray();

    return documents.map((doc: any) => this.mapToEntity(doc)) as any;
  }

  /**
   * Search users by name or email
   */
  async search(searchTerm: string, options: FindOptions = {}): Promise<User[]> {
    const documents = await this.collection
      .find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
        ],
      })
      .sort({ name: 1 })
      .limit(options.limit || 50)
      .skip(options.skip || 0)
      .toArray();

    return documents.map((doc: any) => this.mapToEntity(doc));
  }

  /**
   * Ensure default user exists
   * Creates a default user if none exist
   */
  async ensureDefaultUser(): Promise<void> {
    const count = await this.count();

    if (count === 0) {
      const defaultUser: Omit<User, '_id' | 'createdAt' | 'updatedAt'> = {
        name: 'Default User',
        email: 'default@example.com',
        password: await hash('changeme123', 12),
        role: 'admin',
      };

      await this.create(defaultUser);
    }
  }

  /**
   * Find all admins
   */
  async findAdmins(options: FindOptions = {}): Promise<User[]> {
    return this.findByRole('admin', options);
  }

  /**
   * Find all managers
   */
  async findManagers(options: FindOptions = {}): Promise<User[]> {
    return this.findByRole('manager', options);
  }

  /**
   * Update user role
   */
  async updateRole(userId: string | ObjectId, role: UserRole): Promise<User | null> {
    return this.update(userId, { role } as any);
  }

  /**
   * Override create to validate email uniqueness
   */
  async create(data: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    // Check if email is already taken
    const emailTaken = await this.isEmailTaken(data.email);
    if (emailTaken) {
      throw new Error('Email already in use');
    }

    return super.create(data);
  }

  /**
   * Override update to validate email uniqueness
   */
  async update(
    id: string | ObjectId,
    data: Partial<Omit<User, '_id' | 'createdAt'>>
  ): Promise<User | null> {
    // If email is being updated, check if it's already taken
    if (data.email) {
      const emailTaken = await this.isEmailTaken(data.email, id);
      if (emailTaken) {
        throw new Error('Email already in use');
      }
    }

    return super.update(id, data);
  }

  /**
   * Map database document to entity
   */
  protected mapToEntity(document: any): User {
    const { password: _password, ...rest } = document;
    return {
      ...rest,
      _id: document._id.toString(),
    };
  }
}
