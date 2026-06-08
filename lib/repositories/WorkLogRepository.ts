import type { Collection, ObjectId } from 'mongodb';
import { BaseRepository } from './base/BaseRepository';
import type { FindOptions } from './base/IRepository';
import { ValidationUtils } from '@/lib/api/validation';
import {FORM_STATUS} from "@/lib/constants/constantValues";

/**
 * Personnel entry in a work log
 */
export interface Personnel {
  role: string;
  count: number;
  workDetails?: string;
}

/**
 * Equipment entry in a work log
 */
export interface Equipment {
  type: string;
  count: number;
  hours: number;
}

/**
 * Material entry in a work log
 */
export interface Material {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * Signature entry in a work log
 */
export interface Signature {
  data: string;
  signedBy: string;
  signedAt: string | Date;
  role?: string;
}

/**
 * WorkLog entity interface
 */
export interface WorkLog {
  _id?: string | ObjectId;
  date: string | Date;
  project: string | ObjectId;
  author: string | ObjectId;
  weather?: string;
  temperature?: number;
  workDescription: string;
  status: string;
  personnel?: Personnel[];
  equipment?: Equipment[];
  materials?: Material[];
  notes?: string;
  signatures?: Signature[];
  images?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * WorkLog with populated references
 */
export interface WorkLogWithDetails extends WorkLog {
  projectName?: string;
  projectLocation?: string;
  authorName?: string;
}

/**
 * WorkLog Repository
 * Handles all database operations for work logs
 */
export class WorkLogRepository extends BaseRepository<WorkLog> {
  constructor(collection: any) {
    super(collection);
  }

  /**
   * Find work logs by project ID
   */
  async findByProject(
    projectId: string | ObjectId,
    options: FindOptions = {}
  ): Promise<WorkLog[]> {
    const cleanId = typeof projectId === 'string'
      ? projectId.trim().replace(/^ObjectId\(['"]?/, "").replace(/['"]?\)$/, "")
      : projectId;

    const objectId = ValidationUtils.normalizeObjectId(cleanId);

    return this.findAll(
      {
        $or: [
          { project: cleanId },
          { project: objectId },
        ],
      } as any,
      {
        sort: { createdAt: -1 },
        ...options,
      }
    );
  }

  /**
   * Find work logs by author ID
   */
  async findByAuthor(
    authorId: string | ObjectId,
    options: FindOptions = {}
  ): Promise<WorkLog[]> {
    const objectId = ValidationUtils.normalizeObjectId(authorId);

    return this.findAll(
      { author: objectId } as any,
      {
        sort: { createdAt: -1 },
        ...options,
      }
    );
  }

  /**
   * Find work logs by date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options: FindOptions = {}
  ): Promise<WorkLog[]> {
    const documents = await this.collection
      .find({
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ date: -1 })
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .toArray();

    return documents.map((doc: any) => this.mapToEntity(doc));
  }

  /**
   * Find a work log by ID with populated project and author details
   */
  async findByIdWithDetails(
    id: string | ObjectId,
    projectsCollection: any,
    usersCollection: any
  ): Promise<WorkLogWithDetails | null> {
    const workLog = await this.findById(id);

    if (!workLog) {
      return null;
    }

    const result: WorkLogWithDetails = { ...workLog };

    // Fetch project details
    if (workLog.project) {
      try {
        const projectId = ValidationUtils.normalizeOptionalObjectId(workLog.project);
        if (projectId) {
          const project = await projectsCollection.findOne({ _id: projectId });
          if (project) {
            result.projectName = project.name;
            result.projectLocation = project.location;
          }
        }
      } catch (error) {
        console.error('Error fetching project details:', error);
      }
    }

    // Fetch author details
    if (workLog.author) {
      try {
        const authorId = ValidationUtils.normalizeOptionalObjectId(workLog.author);
        if (authorId) {
          const user = await usersCollection.findOne({ _id: authorId });
          if (user) {
            result.authorName = user.name;
          }
        }
      } catch (error) {
        console.error('Error fetching author details:', error);
      }
    }

    return result;
  }

  /**
   * Get recent work logs with limit
   */
  async findRecent(limit: number = 10): Promise<WorkLog[]> {
    return this.findAll({}, {
      sort: { createdAt: -1 },
      limit,
      projection: {
        _id: 1,
        date: 1,
        project: 1,
        status: 1,
        author: 1,
        workDescription: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });
  }

  /**
   * Search work logs by work description
   */
  async searchByDescription(
    searchTerm: string,
    options: FindOptions = {}
  ): Promise<WorkLog[]> {
    const documents = await this.collection
      .find({
        workDescription: { $regex: searchTerm, $options: 'i' },
      })
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .skip(options.skip || 0)
      .toArray();

    return documents.map((doc: any) => this.mapToEntity(doc));
  }

  /**
   * Override create to normalize ObjectIds
   */
  async create(data: Omit<WorkLog, '_id' | 'createdAt' | 'updatedAt'>): Promise<WorkLog> {
    const normalizedData = {
      ...data,
      project: ValidationUtils.normalizeObjectId(data.project),
      author: ValidationUtils.normalizeObjectId(data.author),
      status: data.status ?? FORM_STATUS.PENDING,
    };

    return super.create(normalizedData as any);
  }

  /**
   * Override update to normalize ObjectIds
   */
  async update(
    id: string | ObjectId,
    data: Partial<Omit<WorkLog, '_id' | 'createdAt'>>
  ): Promise<WorkLog | null> {
    const normalizedData: any = { ...data };

    if (data.project) {
      normalizedData.project = ValidationUtils.normalizeObjectId(data.project);
    }

    if (data.author) {
      normalizedData.author = ValidationUtils.normalizeObjectId(data.author);
    }

    return super.update(id, normalizedData);
  }

  /**
   * Map database document to entity
   */
  protected mapToEntity(document: any): WorkLog {
    return {
      ...document,
      _id: document._id.toString(),
      project: ValidationUtils.objectIdToString(document.project),
      author: ValidationUtils.objectIdToString(document.author),
      date: document.date instanceof Date ? document.date.toISOString() : document.date,
      createdAt: document.createdAt instanceof Date ? document.createdAt : document.createdAt,
      updatedAt: document.updatedAt instanceof Date ? document.updatedAt : document.updatedAt,
    };
  }
}
