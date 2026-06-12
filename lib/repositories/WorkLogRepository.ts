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
  dwgRefs?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Per-day worklog count for calendar views
 */
export interface DayCount {
  date: string;
  count: number;
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
   * Find the most recent work log for a given (author, project) pair.
   * Used to pre-fill the new-worklog form with yesterday's crew/equipment/materials.
   */
  async findMostRecentByAuthorAndProject(
    authorId: string | ObjectId,
    projectId: string | ObjectId
  ): Promise<WorkLog | null> {
    const authorObjectId = ValidationUtils.normalizeObjectId(authorId);
    const projectObjectId = ValidationUtils.normalizeObjectId(projectId);
    const projectStr = typeof projectId === 'string' ? projectId : projectId.toString();

    const document = await this.collection
      .find({
        $and: [
          { author: authorObjectId },
          { $or: [{ project: projectObjectId }, { project: projectStr }] },
        ],
      } as any)
      .sort({ date: -1, createdAt: -1 })
      .limit(1)
      .next();

    return document ? this.mapToEntity(document) : null;
  }

  /**
   * Count work logs per day for a project within a date range (inclusive).
   * Dates are compared as 'YYYY-MM-DD' strings; documents whose date cannot
   * be parsed are excluded.
   */
  async countByDayForProject(
    projectId: string | ObjectId,
    startDay: string,
    endDay: string
  ): Promise<DayCount[]> {
    const objectId = ValidationUtils.normalizeObjectId(projectId);
    const idString = typeof projectId === 'string' ? projectId : projectId.toString();

    const documents = await this.collection.aggregate([
      { $match: { $or: [{ project: objectId }, { project: idString }] } },
      {
        $addFields: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $convert: { input: '$date', to: 'date', onError: null, onNull: null } },
              onNull: null,
            },
          },
        },
      },
      { $match: { day: { $gte: startDay, $lte: endDay } } },
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();

    return documents.map((doc: any) => ({ date: doc._id, count: doc.count }));
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
   * Find a work log by ID with populated project and author details.
   * Uses a single aggregation pipeline instead of 3 separate queries.
   */
  async findByIdWithDetails(id: string | ObjectId): Promise<WorkLogWithDetails | null> {
    const objectId = ValidationUtils.normalizeObjectId(id);

    const documents = await this.collection.aggregate([
      { $match: { _id: objectId } },
      {
        $lookup: {
          from: 'projects',
          localField: 'project',
          foreignField: '_id',
          as: 'projectData',
          pipeline: [{ $project: { name: 1, location: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorData',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $addFields: {
          projectName: { $arrayElemAt: ['$projectData.name', 0] },
          projectLocation: { $arrayElemAt: ['$projectData.location', 0] },
          authorName: { $arrayElemAt: ['$authorData.name', 0] },
        },
      },
      { $project: { projectData: 0, authorData: 0 } },
    ]).toArray();

    if (!documents.length) return null;

    return this.mapToEntity(documents[0]) as WorkLogWithDetails;
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
