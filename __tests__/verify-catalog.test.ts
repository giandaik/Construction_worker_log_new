import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Project from '../lib/models/Project';
import User from '../lib/models/User';
import {
  projectSchema,
  projectUpdateSchema,
  catalogUpdateSchema,
  CATALOG_KINDS,
} from '../lib/schemas/projectSchema';
import { ProjectRepository } from '../lib/repositories/ProjectRepository';

vi.mock('@/utils/auth', () => ({
  getAuthUser: vi.fn(),
  isAdmin: (u: any) => u?.role === 'admin' || u?.role === 'manager',
}));

import { PUT as putCatalog } from '../app/api/projects/[id]/catalog/route';
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

function jsonRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

async function makeProject(): Promise<string> {
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
  });
  return (project._id as Types.ObjectId).toString();
}

describe('Catalog — Zod schemas', () => {
  it('catalogUpdateSchema accepts a known kind and string values', () => {
    const parsed = catalogUpdateSchema.safeParse({
      kind: 'personnelRoles',
      values: ['Εργάτης', 'Χειριστής'],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.values).toEqual(['Εργάτης', 'Χειριστής']);
    }
  });

  it('catalogUpdateSchema rejects an unknown kind', () => {
    const parsed = catalogUpdateSchema.safeParse({
      kind: 'somethingElse',
      values: ['x'],
    });
    expect(parsed.success).toBe(false);
  });

  it('catalogUpdateSchema rejects empty-string values', () => {
    const parsed = catalogUpdateSchema.safeParse({
      kind: 'materialUnits',
      values: ['kg', ''],
    });
    expect(parsed.success).toBe(false);
  });

  it('catalogUpdateSchema dedupes values after trimming', () => {
    const parsed = catalogUpdateSchema.safeParse({
      kind: 'materialNames',
      values: ['Σκυρόδεμα', 'Σκυρόδεμα', '  Σκυρόδεμα  '],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.values).toEqual(['Σκυρόδεμα']);
    }
  });

  it('projectSchema accepts all four catalog arrays', () => {
    const parsed = projectSchema.safeParse({
      name: 'P',
      ownerEmail: 'a@b.co',
      contractorEmail: 'c@d.co',
      personnelRoles: ['A'],
      equipmentTypes: ['B'],
      materialNames: ['C'],
      materialUnits: ['D'],
    });
    expect(parsed.success).toBe(true);
  });

  it('projectUpdateSchema accepts all four catalog arrays', () => {
    const parsed = projectUpdateSchema.safeParse({
      name: 'P',
      ownerEmail: 'a@b.co',
      contractorEmail: 'c@d.co',
      personnelRoles: ['A'],
      equipmentTypes: ['B'],
      materialNames: ['C'],
      materialUnits: ['D'],
    });
    expect(parsed.success).toBe(true);
  });

  it('CATALOG_KINDS exposes the expected four keys', () => {
    expect([...CATALOG_KINDS].sort()).toEqual(
      ['equipmentTypes', 'materialNames', 'materialUnits', 'personnelRoles'].sort(),
    );
  });
});

describe('Catalog — Project model persistence', () => {
  it('saves and reads back the four catalog arrays', async () => {
    const u = await User.create({ name: 'U', email: `u-${Date.now()}@t`, role: 'manager', password: 'x' });
    const project = await Project.create({
      name: 'P-cat',
      description: 'd',
      location: 'L',
      startDate: new Date(),
      ownerEmail: 'a@test',
      contractorEmail: 'b@test',
      ownerUserId: u._id,
      contractorUserId: u._id,
      manager: u._id,
      personnelRoles: ['Εργάτης'],
      equipmentTypes: ['Εκσκαφέας'],
      materialNames: ['Σκυρόδεμα'],
      materialUnits: ['m³'],
    });
    const fresh = await Project.findById(project._id).lean<any>();
    expect(fresh?.personnelRoles).toEqual(['Εργάτης']);
    expect(fresh?.equipmentTypes).toEqual(['Εκσκαφέας']);
    expect(fresh?.materialNames).toEqual(['Σκυρόδεμα']);
    expect(fresh?.materialUnits).toEqual(['m³']);
  });

  it('defaults all four catalog arrays to [] (backward compat)', async () => {
    const u = await User.create({ name: 'U', email: `u-${Date.now()}@t2`, role: 'manager', password: 'x' });
    const project = await Project.create({
      name: 'P-defaults',
      description: 'd',
      location: 'L',
      startDate: new Date(),
      ownerEmail: 'a@test',
      contractorEmail: 'b@test',
      ownerUserId: u._id,
      contractorUserId: u._id,
      manager: u._id,
    });
    const fresh = await Project.findById(project._id).lean<any>();
    expect(fresh?.personnelRoles).toEqual([]);
    expect(fresh?.equipmentTypes).toEqual([]);
    expect(fresh?.materialNames).toEqual([]);
    expect(fresh?.materialUnits).toEqual([]);
  });
});

describe('Catalog — ProjectRepository.setCatalog', () => {
  it('replaces the array atomically, trims and dedupes', async () => {
    const projectId = await makeProject();
    const repo = new ProjectRepository(mongoose.connection.collection('projects'));

    const updated = await repo.setCatalog(projectId, 'personnelRoles', [
      'Εργάτης',
      'Εργάτης',
      '  Χειριστής  ',
      '',
    ]);
    expect(updated?.personnelRoles).toEqual(['Εργάτης', 'Χειριστής']);

    const replaced = await repo.setCatalog(projectId, 'personnelRoles', ['Τεχνίτης']);
    expect(replaced?.personnelRoles).toEqual(['Τεχνίτης']);
  });

  it('returns null for an unknown project id', async () => {
    const repo = new ProjectRepository(mongoose.connection.collection('projects'));
    const result = await repo.setCatalog(
      new Types.ObjectId().toString(),
      'equipmentTypes',
      ['x'],
    );
    expect(result).toBeNull();
  });
});

describe('Catalog — PUT /api/projects/[id]/catalog', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedGetAuthUser.mockResolvedValueOnce(null);
    const res = await putCatalog(
      jsonRequest({ kind: 'personnelRoles', values: ['x'] }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated as worker (role=user)', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'user' });
    const res = await putCatalog(
      jsonRequest({ kind: 'personnelRoles', values: ['x'] }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when body is malformed', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'admin' });
    const res = await putCatalog(
      jsonRequest({ kind: 'nope', values: ['x'] }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown project', async () => {
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'admin' });
    const res = await putCatalog(
      jsonRequest({ kind: 'personnelRoles', values: ['x'] }),
      { params: Promise.resolve({ id: new Types.ObjectId().toString() }) },
    );
    expect(res.status).toBe(404);
  });

  it('happy path: replaces the catalog array on the project', async () => {
    const projectId = await makeProject();
    mockedGetAuthUser.mockResolvedValueOnce({ userId: 'u', name: 'n', role: 'manager' });

    const res = await putCatalog(
      jsonRequest({
        kind: 'materialUnits',
        values: ['m³', 'kg', 'τεμ.'],
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(200);

    const fresh = await Project.findById(projectId).lean<any>();
    expect(fresh?.materialUnits).toEqual(['m³', 'kg', 'τεμ.']);
  });
});
