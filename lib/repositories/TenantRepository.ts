import { ObjectId } from 'mongodb';
import { BaseRepository } from './base/BaseRepository';
import { PLATFORM_CONTEXT } from './base/RepositoryContext';

export interface Tenant {
  _id?: string | ObjectId;
  name: string;
  slug: string;
  status: 'active' | 'disabled' | 'suspended';
  plan: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TenantRepository extends BaseRepository<Tenant> {
  // Tenants are the platform's own catalog of organisations — platform scope
  constructor(collection: any) {
    super(collection, PLATFORM_CONTEXT);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.findOne({ slug } as any);
  }

  async findActive(): Promise<Tenant[]> {
    return this.findAll({ status: 'active' } as any, { sort: { name: 1 } });
  }

  async isSlugTaken(slug: string, excludeId?: string | ObjectId): Promise<boolean> {
    const filter: any = { slug };
    if (excludeId) {
      filter._id = {
        $ne: typeof excludeId === 'string' ? new ObjectId(excludeId) : excludeId,
      };
    }
    return this.exists(filter);
  }
}
