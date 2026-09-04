// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ProjectRepository, WorkLogRepository } from '@/lib/repositories';
import { tenantContext } from '@/lib/repositories/base/RepositoryContext';

let mongoServer: MongoMemoryServer;
let tenantA: mongoose.Types.ObjectId;
let tenantB: mongoose.Types.ObjectId;
let projectA: mongoose.Types.ObjectId;
let projectB: mongoose.Types.ObjectId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  const db = mongoose.connection;
  await db.collection('projects').deleteMany({});
  await db.collection('worklogs').deleteMany({});

  tenantA = new mongoose.Types.ObjectId();
  tenantB = new mongoose.Types.ObjectId();
  projectA = new mongoose.Types.ObjectId();
  projectB = new mongoose.Types.ObjectId();
  const authorA = new mongoose.Types.ObjectId();
  const authorB = new mongoose.Types.ObjectId();

  await db.collection('projects').insertMany([
    { _id: projectA, tenantId: tenantA, name: 'Tenant A project' },
    { _id: projectB, tenantId: tenantB, name: 'Tenant B project' },
  ]);
  await db.collection('worklogs').insertMany([
    {
      tenantId: tenantA,
      project: projectA,
      author: authorA,
      date: new Date('2026-01-01'),
      status: 'pending',
      workDescription: 'A work',
    },
    {
      tenantId: tenantB,
      project: projectB,
      author: authorB,
      date: new Date('2026-01-02'),
      status: 'pending',
      workDescription: 'B work',
    },
  ]);
});

describe('tenant-owned read isolation', () => {
  it('isolates project and worklog lists, counts, and findById', async () => {
    const projectsA = new ProjectRepository(
      mongoose.connection.collection('projects'),
      tenantContext(tenantA.toString()),
    );
    const worklogsA = new WorkLogRepository(
      mongoose.connection.collection('worklogs'),
      tenantContext(tenantA.toString()),
    );

    const projects = await projectsA.findAll();
    const worklogs = await worklogsA.findAll();

    expect(projects.map((project) => project.name)).toEqual(['Tenant A project']);
    expect(worklogs).toHaveLength(1);
    expect(await projectsA.count()).toBe(1);
    expect(await worklogsA.count()).toBe(1);
    expect(await projectsA.findById(projectB.toString())).toBeNull();
    expect(await worklogsA.findById(worklogs[0]._id!.toString())).not.toBeNull();
  });

  it('isolates aggregate-backed dashboard statistics', async () => {
    const worklogsB = new WorkLogRepository(
      mongoose.connection.collection('worklogs'),
      tenantContext(tenantB.toString()),
    );

    expect(await worklogsB.getProjectStats()).toEqual([
      expect.objectContaining({
        project: projectB.toString(),
        worklogCount: 1,
      }),
    ]);
  });
});
