import type { Collection, ObjectId } from 'mongodb';
import { BaseRepository } from './base/BaseRepository';
import type { FindOptions } from './base/IRepository';
import { ValidationUtils } from '@/lib/api/validation';

/**
 * Project status enum
 */
export type ProjectStatus = 'planned' | 'in-progress' | 'completed' | 'on-hold' | 'active';

/**
 * DWG file attached to a project
 */
export interface DwgFile {
  url: string;
  filename: string;
  size: number;
  pdfUrl?: string;
  pdfFilename?: string;
  pdfSize?: number;
  uploadedAt?: Date | string;
  uploadedBy?: string | ObjectId;
}

/**
 * Project entity interface
 */
export interface Project {
  _id?: string | ObjectId;
  name: string;
  description?: string;
  location?: string;
  client?: string;
  startDate?: Date;
  endDate?: Date;
  status?: ProjectStatus;
  manager?: string | ObjectId;
  budget?: number;
  createdAt?: Date;
  updatedAt?: Date;
  ownerEmail: string;
  contractorEmail: string;
  ownerUserId: string | ObjectId;
  contractorUserId: string | ObjectId;
  dwgFiles?: DwgFile[];
}

/**
 * Project Repository
 * Handles all database operations for projects
 */
export class ProjectRepository extends BaseRepository<Project> {
  constructor(collection: any) {
    super(collection);
  }

  /**
   * Find projects by status
   */
  async findByStatus(status: ProjectStatus, options: FindOptions = {}): Promise<Project[]> {
    return this.findAll(
      { status } as any,
      {
        sort: { createdAt: -1 },
        ...options,
      }
    );
  }

  /**
   * Find active projects
   */
  async findActive(options: FindOptions = {}): Promise<Project[]> {
    return this.findAll(
      {
        status: { $in: ['active', 'in-progress'] },
      } as any,
      {
        sort: { name: 1 },
        ...options,
      }
    );
  }

  /**
   * Find projects by manager
   */
  async findByManager(managerId: string | ObjectId, options: FindOptions = {}): Promise<Project[]> {
    return this.findAll(
      { manager: managerId } as any,
      {
        sort: { createdAt: -1 },
        ...options,
      }
    );
  }

  /**
   * Search projects by name
   */
  async searchByName(searchTerm: string, options: FindOptions = {}): Promise<Project[]> {
    const documents = await this.collection
      .find({
        name: { $regex: searchTerm, $options: 'i' },
      })
      .sort({ name: 1 })
      .limit(options.limit || 50)
      .skip(options.skip || 0)
      .toArray();

    return documents.map((doc: any) => this.mapToEntity(doc));
  }

  /**
   * Get projects summary (lightweight for dropdowns)
   */
  async findSummary(): Promise<Pick<Project, '_id' | 'name' | 'description' | 'location' | 'status' | 'manager' | 'startDate' | 'endDate' | 'ownerEmail' | 'contractorEmail' | 'ownerUserId' | 'contractorUserId'>[]> {
    const documents = await this.collection
      .find({})
      .project({ _id: 1, name: 1, description: 1, location: 1, status: 1, manager: 1, startDate: 1, endDate: 1, ownerEmail: 1, contractorEmail: 1, ownerUserId: 1, contractorUserId: 1 })
      .sort({ name: 1 })
      .toArray();

    return documents.map((doc: any) => this.mapToEntity(doc)) as any;
  }

  /**
   * Ensure default project exists
   * Creates a default project if none exist
   */
  async ensureDefaultProject(): Promise<void> {
    const count = await this.count();

    if (count === 0) {
      const defaultProject: Omit<Project, '_id' | 'createdAt' | 'updatedAt'> = {
        name: 'Default Project',
        description: 'Default project for work logs',
        location: 'Default Location',
        ownerEmail: 'owner@example.com',
        contractorEmail: 'contractor@example.com',
        ownerUserId: 'owner-user-id',
        contractorUserId: 'contractor-user-id',
        client: 'Default Client',
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        status: 'active',
        budget: 100000,
      };

      await this.create(defaultProject);
    }
  }

  /**
   * Atomically push a DWG file entry onto a project's dwgFiles array.
   * Returns the updated project.
   */
  async addDwgFile(
    projectId: string | ObjectId,
    dwg: Omit<DwgFile, 'uploadedAt'> & { uploadedAt?: Date }
  ): Promise<Project | null> {
    const objectId = ValidationUtils.normalizeObjectId(projectId);
    const entry: DwgFile = {
      ...dwg,
      uploadedBy: dwg.uploadedBy
        ? ValidationUtils.normalizeObjectId(dwg.uploadedBy)
        : undefined,
      uploadedAt: dwg.uploadedAt ?? new Date(),
    };

    const result = await this.collection.findOneAndUpdate(
      { _id: objectId } as any,
      {
        $push: { dwgFiles: entry },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return result ? this.mapToEntity(result) : null;
  }

  /**
   * Atomically remove a DWG file entry (matched by url) from a project's dwgFiles array.
   * Returns the updated project, or null if not found.
   */
  async removeDwgFile(
    projectId: string | ObjectId,
    url: string
  ): Promise<Project | null> {
    const objectId = ValidationUtils.normalizeObjectId(projectId);

    const result = await this.collection.findOneAndUpdate(
      { _id: objectId } as any,
      {
        $pull: { dwgFiles: { url } },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return result ? this.mapToEntity(result) : null;
  }

  /**
   * Find projects within budget range
   */
  async findByBudgetRange(minBudget: number, maxBudget: number, options: FindOptions = {}): Promise<Project[]> {
    const documents = await this.collection
      .find({
        budget: {
          $gte: minBudget,
          $lte: maxBudget,
        },
      })
      .sort({ budget: -1 })
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .toArray();

    return documents.map((doc: any) => this.mapToEntity(doc));
  }

  /**
   * Find projects by date range (start date)
   */
  async findByStartDateRange(startDate: Date, endDate: Date, options: FindOptions = {}): Promise<Project[]> {
    const documents = await this.collection
      .find({
        startDate: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ startDate: -1 })
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .toArray();

    return documents.map((doc: any) => this.mapToEntity(doc));
  }

  /**
   * Map database document to entity
   */
  protected mapToEntity(document: any): Project {
    return {
      ...document,
      _id: document._id.toString(),
      manager: document.manager ? document.manager.toString() : undefined,
    };
  }
}
