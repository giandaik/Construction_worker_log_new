import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { dbConnect } from '../lib/dbConnect';
import { WorkerActionRow } from '../components/WorkerActionRow';
import { WorkLog, Project, User } from '../lib/models';

let mongoServer: MongoMemoryServer;

/** WorkerActionRow is tenant-scoped: nothing renders without a real tenant. */
const TENANT_ID = '507f1f77bcf86cd799439011';
const TENANT_OBJECT_ID = new mongoose.Types.ObjectId(TENANT_ID);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await dbConnect();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await WorkLog.deleteMany({});
  await Project.deleteMany({});
  await User.deleteMany({});
});

async function renderForUser(userId: string) {
  const element = await WorkerActionRow({ userId, tenantId: TENANT_ID });
  return render(element as React.ReactElement);
}

async function seedProject(name: string) {
  const projectId = new mongoose.Types.ObjectId();
  await Project.create({
    _id: projectId,
    name,
    description: 'x',
    location: 'x',
    startDate: new Date(),
    endDate: new Date(),
    status: 'in-progress',
    manager: new mongoose.Types.ObjectId(),
    ownerEmail: 'owner@example.com',
    contractorEmail: 'contractor@example.com',
    ownerUserId: new mongoose.Types.ObjectId(),
    contractorUserId: new mongoose.Types.ObjectId(),
    tenantId: TENANT_OBJECT_ID,
  });
  return projectId;
}

describe('WorkerActionRow', () => {
  it('links the draft card to the edit page when a pending log exists', async () => {
    const userId = new mongoose.Types.ObjectId();
    const projectId = await seedProject('Athens Tower');
    const draft = await WorkLog.create({
      tenantId: TENANT_OBJECT_ID,
      author: userId,
      project: projectId,
      date: new Date('2026-06-20'),
      workDescription: 'Pour slab',
      status: 'pending',
      personnel: [],
      equipment: [],
      materials: [],
    });

    await renderForUser(userId.toString());

    const card = screen.getByText('Continue draft').closest('a');
    expect(card).toHaveAttribute('href', `/worklogs/${draft._id.toString()}/edit`);
  });

  it('shows Start today\'s log when the worker has no draft', async () => {
    const userId = new mongoose.Types.ObjectId();
    const projectId = await seedProject('Kifissia House');
    await WorkLog.create({
      tenantId: TENANT_OBJECT_ID,
      author: userId,
      project: projectId,
      date: new Date('2026-06-19'),
      workDescription: 'Framing',
      status: 'signed',
      personnel: [],
      equipment: [],
      materials: [],
    });

    await renderForUser(userId.toString());

    expect(screen.getByText("Start today's log").closest('a'))
      .toHaveAttribute('href', '/logs/new');
  });

  it('links the recent card to the last submitted log detail', async () => {
    const userId = new mongoose.Types.ObjectId();
    const projectId = await seedProject('Kifissia House');
    const recent = await WorkLog.create({
      tenantId: TENANT_OBJECT_ID,
      author: userId,
      project: projectId,
      date: new Date('2026-06-19'),
      workDescription: 'Framing',
      status: 'signed',
      personnel: [],
      equipment: [],
      materials: [],
    });

    await renderForUser(userId.toString());

    expect(screen.getByText('Last submitted log').closest('a'))
      .toHaveAttribute('href', `/worklogs/${recent._id.toString()}`);
  });

  it('renders only the primary card when the worker has no logs at all', async () => {
    const userId = new mongoose.Types.ObjectId();

    await renderForUser(userId.toString());

    expect(screen.queryByText('Last submitted log')).not.toBeInTheDocument();
  });

  it('prefers the latest pending log when multiple drafts exist', async () => {
    const userId = new mongoose.Types.ObjectId();
    const projectId = await seedProject('Athens Tower');
    await WorkLog.create({
      tenantId: TENANT_OBJECT_ID,
      author: userId,
      project: projectId,
      date: new Date('2026-06-18'),
      workDescription: 'Old draft',
      status: 'pending',
      personnel: [],
      equipment: [],
      materials: [],
    });
    const newer = await WorkLog.create({
      tenantId: TENANT_OBJECT_ID,
      author: userId,
      project: projectId,
      date: new Date('2026-06-20'),
      workDescription: 'Newer draft',
      status: 'pending',
      personnel: [],
      equipment: [],
      materials: [],
    });

    await renderForUser(userId.toString());

    expect(screen.getByText('Continue draft').closest('a'))
      .toHaveAttribute('href', `/worklogs/${newer._id.toString()}/edit`);
  });

  it('opens the newest draft when two share an updatedAt', async () => {
    // Two drafts written in the same millisecond tie on updatedAt; the tie must
    // resolve on _id, or "Continue draft" opens whichever document Mongo reads
    // first. Inserted raw so the timestamps are identical by construction
    // rather than by luck.
    const userId = new mongoose.Types.ObjectId();
    const projectId = await seedProject('Athens Tower');
    const shared = new Date('2026-06-20T09:00:00.000Z');
    const olderId = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaa01');
    const newerId = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaa02');
    await WorkLog.collection.insertMany([
      {
        _id: olderId, tenantId: TENANT_OBJECT_ID, author: userId, project: projectId,
        date: new Date('2026-06-19'), workDescription: 'Older draft', status: 'pending',
        personnel: [], equipment: [], materials: [],
        createdAt: shared, updatedAt: shared,
      },
      {
        _id: newerId, tenantId: TENANT_OBJECT_ID, author: userId, project: projectId,
        date: new Date('2026-06-20'), workDescription: 'Newer draft', status: 'pending',
        personnel: [], equipment: [], materials: [],
        createdAt: shared, updatedAt: shared,
      },
    ]);

    await renderForUser(userId.toString());

    expect(screen.getByText('Continue draft').closest('a'))
      .toHaveAttribute('href', `/worklogs/${newerId.toString()}/edit`);
  });

  it("excludes another worker's logs", async () => {
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const projectId = await seedProject('Athens Tower');
    await WorkLog.create({
      tenantId: TENANT_OBJECT_ID,
      author: otherUserId,
      project: projectId,
      date: new Date('2026-06-20'),
      workDescription: "Someone else's draft",
      status: 'pending',
      personnel: [],
      equipment: [],
      materials: [],
    });

    await renderForUser(userId.toString());

    expect(screen.queryByText('Continue draft')).not.toBeInTheDocument();
    expect(screen.getByText("Start today's log")).toBeInTheDocument();
  });
});
