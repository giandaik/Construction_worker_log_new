import type { Collection, ObjectId } from 'mongodb';
import type { IRepository, FindOptions } from './IRepository';
import type { RepositoryContext } from './RepositoryContext';
import { ValidationUtils } from '@/lib/api/validation';
import { normalizeTenantId } from '@/lib/tenant/normalizeTenantId';

/**
 * Abstract Base Repository
 *
 * Tenant isolation model:
 *   - The raw MongoDB collection handle is `private`. Subclasses cannot
 *     reach it directly, so a new custom query method cannot accidentally
 *     forget to apply the tenant filter — there is no `this.collection` to
 *     misuse.
 *   - Every read/write is routed through `scopeFilter()` / `scopePipeline()`,
 *     which inject `{ tenantId }` for tenant-scoped contexts and are a no-op
 *     for platform-scoped contexts.
 *   - The constructor requires an explicit `RepositoryContext` (never an
 *     optional/nullable `tenantId`), so "forgot to scope" is not a state
 *     that can exist — see `lib/repositories/base/RepositoryContext.ts`.
 */
export abstract class BaseRepository<T extends { _id?: string | ObjectId }> implements IRepository<T> {
  /**
   * Fields a client may never set through `update()`.
   *
   * `tenantId` is the isolation invariant and is always derived from the auth
   * context; `_id` and `createdAt` are server-assigned identity and
   * provenance. Routes should still validate their bodies, but this is the
   * choke point that holds even when one forgets.
   *
   * `author` is deliberately NOT here: reassigning a work log's author is a
   * real feature (the edit form renders an author picker). It is constrained
   * at the schema layer instead — it must be an ObjectId string — and the
   * route already gates who may edit at all via `canModify`.
   */
  private static readonly IMMUTABLE_FIELDS = [
    'tenantId',
    '_id',
    'createdAt',
  ] as const;

  private collection: any;
  protected readonly context: RepositoryContext;

  constructor(collection: any, context: RepositoryContext) {
    this.collection = collection;
    this.context = context;
  }

  /** The active tenantId string from JWT/session, or undefined in platform scope. */
  protected get tenantId(): string | undefined {
    return this.context.scope === 'tenant' ? this.context.tenantId : undefined;
  }

  /** BSON ObjectId for MongoDB tenant-scoped reads/writes. Platform scope has none. */
  protected get normalizedTenantId(): ObjectId {
    if (this.context.scope !== 'tenant') {
      throw new Error('normalizedTenantId() requires a tenant-scoped repository context');
    }
    return normalizeTenantId(this.context.tenantId);
  }

  /** Merges the tenant filter into a query filter. No-op in platform scope. */
  protected scopeFilter(filter: Record<string, any> = {}): Record<string, any> {
    return this.context.scope === 'tenant'
      ? { ...filter, tenantId: this.normalizedTenantId }
      : filter;
  }

  /**
   * Prepends a tenant `$match` stage to an aggregation pipeline so filtering
   * happens before any `$lookup`/`$group`/`$unwind` stage can touch other
   * tenants' data. No-op in platform scope.
   */
  protected scopePipeline(pipeline: Record<string, any>[]): Record<string, any>[] {
    return this.context.scope === 'tenant'
      ? [{ $match: { tenantId: this.normalizedTenantId } }, ...pipeline]
      : pipeline;
  }

  // ---- Sanctioned raw-query helpers for subclasses ----------------------
  // These are the ONLY sanctioned way for a subclass to reach the driver.
  // Each one routes the filter/pipeline through scopeFilter()/scopePipeline()
  // above, so custom query methods get tenant isolation "for free".

  protected scopedFindCursor(filter: Record<string, any> = {}) {
    return this.collection.find(this.scopeFilter(filter));
  }

  protected async scopedFindOneRaw(filter: Record<string, any>): Promise<any | null> {
    return this.collection.findOne(this.scopeFilter(filter));
  }

  protected async scopedAggregate(pipeline: Record<string, any>[]): Promise<any[]> {
    return this.collection.aggregate(this.scopePipeline(pipeline)).toArray();
  }

  protected async scopedFindOneAndUpdate(
    filter: Record<string, any>,
    update: Record<string, any>,
    options: Record<string, any> = { returnDocument: 'after' }
  ): Promise<any | null> {
    return this.collection.findOneAndUpdate(this.scopeFilter(filter), update, options);
  }

  protected async scopedUpdateOne(
    filter: Record<string, any>,
    update: Record<string, any>,
    options: Record<string, any> = {}
  ): Promise<any> {
    return this.collection.updateOne(this.scopeFilter(filter), update, options);
  }

  protected async scopedDeleteOneRaw(filter: Record<string, any>): Promise<any> {
    return this.collection.deleteOne(this.scopeFilter(filter));
  }

  protected async scopedCountRaw(filter: Record<string, any> = {}): Promise<number> {
    return this.collection.countDocuments(this.scopeFilter(filter));
  }

  // ---- Generic CRUD (IRepository) ----------------------------------------

  async findAll(filter: Partial<T> = {}, options: FindOptions = {}): Promise<T[]> {
    const { limit, skip, sort, projection } = options;
    let query = this.scopedFindCursor(filter as Record<string, any>);
    if (projection) query = query.project(projection);
    if (sort) query = query.sort(sort);
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    const documents = await query.toArray();
    return documents.map((doc: any) => this.mapToEntity(doc));
  }

  /**
   * Find a single document by ID
   */
  async findById(id: string | ObjectId): Promise<T | null> {
    const objectId = ValidationUtils.normalizeObjectId(id);
    const document = await this.scopedFindOneRaw({ _id: objectId });
    return document ? this.mapToEntity(document) : null;
  }

  /**
   * Find a single document matching the filter
   */
  async findOne(filter: Partial<T>): Promise<T | null> {
    const document = await this.scopedFindOneRaw(filter as Record<string, any>);
    return document ? this.mapToEntity(document) : null;
  }

  /**
   * Create a new document
   */
  async create(data: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date();
    const documentToInsert: any = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    // Never trust a client-supplied tenantId — always derive from auth context.
    delete documentToInsert.tenantId;
    if (this.context.scope === 'tenant') {
      documentToInsert.tenantId = this.normalizedTenantId;
    }

    const result = await this.collection.insertOne(documentToInsert);
    const createdDocument = await this.scopedFindOneRaw({ _id: result.insertedId });
    if (!createdDocument) throw new Error('Failed to retrieve created document');
    return this.mapToEntity(createdDocument);
  }

  /**
   * Update a document by ID
   *
   * `data` may originate from a request body, so the server-owned identity
   * fields are stripped before it reaches `$set` — the same guard `create()`
   * applies. Without this, a client could send `{"tenantId": "..."}` and move
   * a document out of its own tenant: `scopeFilter()` scopes the *lookup*,
   * not the payload, so the write itself was unconstrained.
   */
  async update(id: string | ObjectId, data: Partial<Omit<T, '_id' | 'createdAt'>>): Promise<T | null> {
    const objectId = ValidationUtils.normalizeObjectId(id);
    const $set: any = { ...data, updatedAt: new Date() };
    for (const immutable of BaseRepository.IMMUTABLE_FIELDS) {
      delete $set[immutable];
    }

    // scopeFilter() (inside scopedFindOneAndUpdate) prevents cross-tenant updates
    const result = await this.scopedFindOneAndUpdate(
      { _id: objectId },
      { $set }
    );

    return result ? this.mapToEntity(result) : null;
  }

  /**
   * Delete a document by ID
   */
  async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = ValidationUtils.normalizeObjectId(id);
    // scopeFilter() (inside scopedDeleteOneRaw) prevents cross-tenant deletes
    const result = await this.scopedDeleteOneRaw({ _id: objectId });
    return result.deletedCount > 0;
  }

  /**
   * Count documents matching the filter
   */
  async count(filter: Partial<T> = {}): Promise<number> {
    return this.scopedCountRaw(filter as Record<string, any>);
  }

  /**
   * Check if a document exists
   */
  async exists(filter: Partial<T>): Promise<boolean> {
    return (await this.count(filter)) > 0;
  }

  /**
   * Map database document to entity
   * Can be overridden by child classes for custom mapping
   */
  protected mapToEntity(document: any): T {
    return { ...document, _id: document._id.toString() } as T;
  }

  /**
   * Normalize filter to handle ObjectId fields
   * Can be overridden by child classes for custom normalization
   */
  protected normalizeFilter(filter: Partial<T>): any {
    return filter;
  }
}
