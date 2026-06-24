import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Project from '../lib/models/Project';
import User from '../lib/models/User';
import { ProjectRepository } from '../lib/repositories/ProjectRepository';
import {
  mergeCatalogValues,
  mergeCatalog,
  diffCatalog,
  toProjectCatalog,
  totalCatalogCount,
  EMPTY_CATALOG,
  type ProjectCatalog,
} from '../lib/catalog/mergeCatalog';

vi.mock('@/utils/auth', () => ({
  getAuthUser: vi.fn(),
  isAdmin: (u: any) => u?.role === 'admin' || u?.role === 'manager',
}));

import { POST as importCatalog } from '../app/api/projects/[id]/catalog/import/route';
import { GET as getCatalogSources } from '../app/api/projects/catalog-sources/route';
import { getAuthUser } from '@/utils/auth';

const mockedGetAuthUser = vi.mocked(getAuthUser);

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Project.deleteMany({});
  await User.deleteMany({});
  mockedGetAuthUser.mockReset();
});

function jsonRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function catalogOf(partial: Partial<ProjectCatalog>): ProjectCatalog {
  return { ...EMPTY_CATALOG, ...partial };
}

async function makeProject(catalog: Partial<ProjectCatalog> = {}): Promise<string> {
  const u = await User.create({
    name: 'PM',
    email: `pm-${Date.now()}-${Math.random()}@test`,
    role: 'manager',
    password: 'x',
  });
  const project = await Project.create({
    name: 'P',
    description: 'd',
    location: 'L',
    startDate: new Date(),
    ownerEmail: 'a@test',
    contractorEmail: 'b@test',
    ownerUserId: u._id,
    contractorUserId: u._id,
    manager: u._id,
    ...catalog,
  });
  return (project._id as Types.ObjectId).toString();
}

describe('mergeCatalogValues', () => {
  it('appends new values to the base, preserving order', () => {
    expect(mergeCatalogValues(['A', 'B'], ['C', 'D'])).toEqual(['A', 'B', 'C', 'D']);
  });

  it('de-duplicates against the base', () => {
    expect(mergeCatalogValues(['A', 'B'], ['B', 'C'])).toEqual(['A', 'B', 'C']);
  });

  it('trims and drops blanks', () => {
    expect(mergeCatalogValues(['A'], ['  B  ', '   ', 'A'])).toEqual(['A', 'B']);
  });

  it('handles an empty base (pure copy)', () => {
    expect(mergeCatalogValues([], ['Εργάτης', 'Χειριστής'])).toEqual(['Εργάτης', 'Χειριστής']);
  });

  it('handles an empty source (no change)', () => {
    expect(mergeCatalogValues(['A', 'B'], [])).toEqual(['A', 'B']);
  });
});

describe('mergeCatalog', () => {
  it('merges all four kinds additively', () => {
    const base = catalogOf({ personnelRoles: ['Εργάτης'], materialUnits: ['kg'] });
    const source = catalogOf({
      personnelRoles: ['Εργάτης', 'Χειριστής'],
      equipmentTypes: ['Εκσκαφέας'],
      materialUnits: ['m³'],
    });
    expect(mergeCatalog(base, source)).toEqual({
      personnelRoles: ['Εργάτης', 'Χειριστής'],
      equipmentTypes: ['Εκσκαφέας'],
      materialNames: [],
      materialUnits: ['kg', 'm³'],
    });
  });
});

describe('diffCatalog', () => {
  it('counts added vs already-existing per kind', () => {
    const base = catalogOf({ personnelRoles: ['Εργάτης'] });
    const source = catalogOf({ personnelRoles: ['Εργάτης', 'Χειριστής', 'Μηχανικός'] });
    expect(diffCatalog(base, source).personnelRoles).toEqual({ added: 2, existing: 1 });
  });

  it('ignores duplicate source values when counting', () => {
    const source = catalogOf({ equipmentTypes: ['Γερανός', 'Γερανός'] });
    expect(diffCatalog(EMPTY_CATALOG, source).equipmentTypes).toEqual({ added: 1, existing: 0 });
  });
});

describe('toProjectCatalog / totalCatalogCount', () => {
  it('fills missing kinds and ignores non-string entries', () => {
    const result = toProjectCatalog({ personnelRoles: ['A', 2 as any], equipmentTypes: undefined });
    expect(result.personnelRoles).toEqual(['A']);
    expect(result.equipmentTypes).toEqual([]);
    expect(result.materialNames).toEqual([]);
  });

  it('totals across all kinds', () => {
    expect(totalCatalogCount(catalogOf({ personnelRoles: ['A', 'B'], materialUnits: ['kg'] }))).toBe(3);
  });
});

describe('ProjectRepository.mergeCatalog', () => {
  it('unions the source catalog into the target, de-duplicating', async () => {
    const targetId = await makeProject({ personnelRoles: ['Εργάτης'], materialUnits: ['kg'] });
    const repo = new ProjectRepository(mongoose.connection.collection('projects'));

    const updated = await repo.mergeCatalog(targetId, {
      personnelRoles: ['Εργάτης', 'Χειριστής'],
      equipmentTypes: ['Εκσκαφέας'],
    });

    expect(updated?.personnelRoles).toEqual(['Εργάτης', 'Χειριστής']);
    expect(updated?.equipmentTypes).toEqual(['Εκσκαφέας']);
    expect(updated?.materialUnits).toEqual(['kg']);
  });

  it('returns null for a missing target', async () => {
    const repo = new ProjectRepository(mongoose.connection.collection('projects'));
    const result = await repo.mergeCatalog(new Types.ObjectId().toString(), { personnelRoles: ['X'] });
    expect(result).toBeNull();
  });
});

describe('ProjectRepository.findCatalogSummaries', () => {
  it('returns id, name, and total catalog count per project', async () => {
    await makeProject({ personnelRoles: ['A', 'B'], materialUnits: ['kg'] });
    await makeProject();
    const repo = new ProjectRepository(mongoose.connection.collection('projects'));

    const summaries = await repo.findCatalogSummaries();
    expect(summaries).toHaveLength(2);
    const totals = summaries.map((s) => s.total).sort();
    expect(totals).toEqual([0, 3]);
  });
});

describe('POST /api/projects/[id]/catalog/import', () => {
  it('rejects unauthenticated requests', async () => {
    mockedGetAuthUser.mockResolvedValue(null as any);
    const res = await importCatalog(jsonRequest({ sourceProjectId: 'x' }), {
      params: Promise.resolve({ id: 'y' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects non-admin/manager users', async () => {
    mockedGetAuthUser.mockResolvedValue({ role: 'user' } as any);
    const res = await importCatalog(jsonRequest({ sourceProjectId: 'x' }), {
      params: Promise.resolve({ id: 'y' }),
    });
    expect(res.status).toBe(403);
  });

  it('merges the source catalog into the target (happy path)', async () => {
    mockedGetAuthUser.mockResolvedValue({ role: 'manager' } as any);
    const sourceId = await makeProject({ personnelRoles: ['Εργάτης', 'Χειριστής'], materialUnits: ['m³'] });
    const targetId = await makeProject({ personnelRoles: ['Εργάτης'] });

    const res = await importCatalog(jsonRequest({ sourceProjectId: sourceId }), {
      params: Promise.resolve({ id: targetId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.personnelRoles).toEqual(['Εργάτης', 'Χειριστής']);
    expect(body.materialUnits).toEqual(['m³']);
  });

  it('rejects importing a project into itself', async () => {
    mockedGetAuthUser.mockResolvedValue({ role: 'manager' } as any);
    const id = await makeProject({ personnelRoles: ['A'] });
    const res = await importCatalog(jsonRequest({ sourceProjectId: id }), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the source project does not exist', async () => {
    mockedGetAuthUser.mockResolvedValue({ role: 'manager' } as any);
    const targetId = await makeProject();
    const res = await importCatalog(jsonRequest({ sourceProjectId: new Types.ObjectId().toString() }), {
      params: Promise.resolve({ id: targetId }),
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/projects/catalog-sources', () => {
  it('rejects non-admin/manager users', async () => {
    mockedGetAuthUser.mockResolvedValue({ role: 'user' } as any);
    const res = await getCatalogSources();
    expect(res.status).toBe(403);
  });

  it('returns per-project catalog totals for admins', async () => {
    mockedGetAuthUser.mockResolvedValue({ role: 'admin' } as any);
    await makeProject({ personnelRoles: ['A', 'B'] });
    const res = await getCatalogSources();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty('total');
  });
});
