// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { WorkLogRepository } from '@/lib/repositories';
import { tenantContext } from '@/lib/repositories/base/RepositoryContext';
import { workLogCreateSchema, workLogUpdateSchema } from '@/lib/schemas/workLogSchema';

let mongoServer: MongoMemoryServer;
let tenantA: mongoose.Types.ObjectId;
let tenantB: mongoose.Types.ObjectId;
let logA: mongoose.Types.ObjectId;

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
  await db.collection('worklogs').deleteMany({});

  tenantA = new mongoose.Types.ObjectId();
  tenantB = new mongoose.Types.ObjectId();
  logA = new mongoose.Types.ObjectId();

  await db.collection('worklogs').insertOne({
    _id: logA,
    tenantId: tenantA,
    project: new mongoose.Types.ObjectId(),
    author: new mongoose.Types.ObjectId(),
    date: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    status: 'pending',
    workDescription: 'A work',
  });
});

function repoForTenantA() {
  return new WorkLogRepository(
    mongoose.connection.collection('worklogs'),
    tenantContext(tenantA.toString()),
  );
}

describe('H2 — update() cannot move a document between tenants', () => {
  it('drops tenantId from the $set payload', async () => {
    const updated = await repoForTenantA().update(logA.toString(), {
      notes: 'legitimate edit',
      tenantId: tenantB.toString(),
    } as never);

    expect(updated?.notes).toBe('legitimate edit');

    const raw = await mongoose.connection
      .collection('worklogs')
      .findOne({ _id: logA });
    expect(raw?.tenantId.toString()).toBe(tenantA.toString());
  });

  it('drops _id and createdAt from the $set payload', async () => {
    const foreignId = new mongoose.Types.ObjectId();
    await repoForTenantA().update(logA.toString(), {
      _id: foreignId.toString(),
      createdAt: new Date('2000-01-01'),
      notes: 'edit',
    } as never);

    const raw = await mongoose.connection
      .collection('worklogs')
      .findOne({ _id: logA });
    expect(raw).not.toBeNull();
    expect(raw?.createdAt).toEqual(new Date('2026-01-01'));
  });

  it('still applies the legitimate fields it was given', async () => {
    const updated = await repoForTenantA().update(logA.toString(), {
      weather: 'rain',
      temperature: 11,
    } as never);

    expect(updated?.weather).toBe('rain');
    expect(updated?.temperature).toBe(11);
  });

  it('leaves another tenant\'s document untouched', async () => {
    const foreign = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('worklogs').insertOne({
      _id: foreign,
      tenantId: tenantB,
      project: new mongoose.Types.ObjectId(),
      author: new mongoose.Types.ObjectId(),
      date: new Date('2026-01-02'),
      status: 'pending',
      workDescription: 'B work',
    });

    expect(
      await repoForTenantA().update(foreign.toString(), { notes: 'pwn' } as never),
    ).toBeNull();

    const raw = await mongoose.connection
      .collection('worklogs')
      .findOne({ _id: foreign });
    expect(raw?.notes).toBeUndefined();
  });
});

describe('M4 — request schemas reject unknown keys', () => {
  const validCreate = {
    date: '2026-01-01',
    project: '6a9b1f675b379afdd4d885cd',
    workDescription: 'work',
  };

  it('accepts a legitimate create body', () => {
    expect(workLogCreateSchema.safeParse(validCreate).success).toBe(true);
  });

  it('accepts the full body the create form sends', () => {
    const result = workLogCreateSchema.safeParse({
      ...validCreate,
      author: '6a9b1f665b379afdd4d885c5',
      weather: 'sunny',
      temperature: 22,
      personnel: [{ role: 'Mason', count: 2, workDetails: 'walls' }],
      equipment: [{ type: 'Crane', count: 1, hours: 4 }],
      materials: [{ name: 'Cement', quantity: 10, unit: 'bags' }],
      notes: 'n',
      images: [],
      dwgRefs: [],
      signatures: [],
      status: 'draft',
    });
    expect(result.success).toBe(true);
  });

  it('rejects tenantId on create', () => {
    const result = workLogCreateSchema.safeParse({
      ...validCreate,
      tenantId: '6a9b1f665b379afdd4d885c4',
    });
    expect(result.success).toBe(false);
  });

  it('rejects tenantId on update', () => {
    const result = workLogUpdateSchema.safeParse({
      notes: 'x',
      tenantId: '6a9b1f665b379afdd4d885c4',
    });
    expect(result.success).toBe(false);
  });

  it('rejects _id and createdAt on update', () => {
    expect(workLogUpdateSchema.safeParse({ _id: 'x' }).success).toBe(false);
    expect(
      workLogUpdateSchema.safeParse({ createdAt: '2000-01-01' }).success,
    ).toBe(false);
  });

  it('rejects an unknown key on update', () => {
    expect(
      workLogUpdateSchema.safeParse({ notes: 'x', isSuperAdmin: true }).success,
    ).toBe(false);
  });

  it('rejects a non-ObjectId project', () => {
    expect(
      workLogCreateSchema.safeParse({ ...validCreate, project: { $ne: null } })
        .success,
    ).toBe(false);
  });

  it('accepts the partial body the approve flow sends', () => {
    const result = workLogUpdateSchema.safeParse({
      signatures: [
        {
          data: 'data:image/png;base64,AAA',
          signedBy: 'Alice Admin',
          signedAt: '2026-09-05T10:00:00.000Z',
          projectRole: 'owner',
          signedByUserId: '6a9b1f665b379afdd4d885c5',
        },
      ],
      status: 'completed',
    });
    expect(result.success).toBe(true);
  });

  it('accepts offline-queue rows that omit workDetails and hours', () => {
    const result = workLogCreateSchema.safeParse({
      ...validCreate,
      personnel: [{ role: 'Mason', count: 2 }],
      equipment: [{ type: 'Crane', count: 1 }],
    });
    expect(result.success).toBe(true);
  });
});
