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
  const element = await WorkerActionRow({ userId });
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
  });
  return projectId;
}

describe('WorkerActionRow', () => {
  it('links the draft card to the edit page when a pending log exists', async () => {
    const userId = new mongoose.Types.ObjectId();
    const projectId = await seedProject('Athens Tower');
    const draft = await WorkLog.create({
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

  it('excludes another worker\'s logs', async () => {
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const projectId = await seedProject('Athens Tower');
    await WorkLog.create({
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
