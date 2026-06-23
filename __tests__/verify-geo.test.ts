import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Project from '../lib/models/Project';
import User from '../lib/models/User';
import { projectSchema, projectUpdateSchema } from '../lib/schemas/projectSchema';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const baseProject = {
  name: 'Geo Test Project',
  ownerEmail: 'owner@example.com',
  contractorEmail: 'contractor@example.com',
};

describe('Project geolocation — Zod schema', () => {
  it('accepts valid latitude/longitude on projectSchema', () => {
    const parsed = projectSchema.parse({
      ...baseProject,
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(parsed.latitude).toBe(40.7128);
    expect(parsed.longitude).toBe(-74.006);
  });

  it('still parses when latitude/longitude are omitted (optional)', () => {
    const parsed = projectSchema.parse(baseProject);
    expect(parsed.latitude).toBeUndefined();
    expect(parsed.longitude).toBeUndefined();
  });

  it('rejects latitude outside [-90, 90]', () => {
    const result = projectSchema.safeParse({ ...baseProject, latitude: 200 });
    expect(result.success).toBe(false);
  });

  it('rejects longitude outside [-180, 180]', () => {
    const result = projectSchema.safeParse({ ...baseProject, longitude: -999 });
    expect(result.success).toBe(false);
  });

  it('accepts valid latitude/longitude on projectUpdateSchema', () => {
    const parsed = projectUpdateSchema.parse({
      ...baseProject,
      latitude: -33.8688,
      longitude: 151.2093,
    });
    expect(parsed.latitude).toBe(-33.8688);
    expect(parsed.longitude).toBe(151.2093);
  });
});

describe('Project geolocation — persistence', () => {
  it('persists and returns latitude/longitude', async () => {
    const user = await User.create({
      email: 'geo-manager@example.com',
      password: 'irrelevant-hash',
      role: 'manager',
      name: 'Geo Manager',
    });

    const created = await Project.create({
      name: 'Persisted Geo Project',
      location: 'Somewhere',
      startDate: new Date(),
      status: 'planned',
      manager: user._id as Types.ObjectId,
      ownerEmail: 'owner@example.com',
      contractorEmail: 'contractor@example.com',
      ownerUserId: user._id as Types.ObjectId,
      contractorUserId: user._id as Types.ObjectId,
      latitude: 37.7749,
      longitude: -122.4194,
    });

    const reloaded = (await Project.findById(created._id).lean()) as {
      latitude?: number;
      longitude?: number;
    } | null;
    expect(reloaded?.latitude).toBe(37.7749);
    expect(reloaded?.longitude).toBe(-122.4194);
  });
});
