import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../lib/models/User';

// Admin auth so POST/PUT pass the isAdmin gate; route never reads other user fields.
vi.mock('@/utils/auth', () => ({
  getAuthUser: vi.fn(),
  isAdmin: (u: any) => u?.role === 'admin' || u?.role === 'manager',
}));

import { POST } from '../app/api/projects/route';
import { GET, PUT } from '../app/api/projects/[id]/route';
import { getAuthUser } from '@/utils/auth';

const mockedGetAuthUser = vi.mocked(getAuthUser);

let mongoServer: MongoMemoryServer;
let projectId: string;

const OWNER = 'geo-owner@example.com';
const CONTRACTOR = 'geo-contractor@example.com';

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());

  await User.create({ email: OWNER, password: 'hash', role: 'user', name: 'Owner' });
  await User.create({ email: CONTRACTOR, password: 'hash', role: 'user', name: 'Contractor' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  mockedGetAuthUser.mockResolvedValue({ role: 'admin' } as any);
});

describe('Project geolocation — API routes pass coordinates through', () => {
  it('POST /api/projects persists latitude/longitude', async () => {
    const res = await POST(
      jsonRequest('http://localhost/api/projects', 'POST', {
        name: 'Geo API Project',
        ownerEmail: OWNER,
        contractorEmail: CONTRACTOR,
        latitude: 40.7128,
        longitude: -74.006,
      })
    );

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.latitude).toBe(40.7128);
    expect(created.longitude).toBe(-74.006);
    projectId = created._id;
  });

  it('PUT /api/projects/:id updates latitude/longitude', async () => {
    const res = await PUT(
      jsonRequest(`http://localhost/api/projects/${projectId}`, 'PUT', {
        name: 'Geo API Project',
        ownerEmail: OWNER,
        contractorEmail: CONTRACTOR,
        latitude: 34.0522,
        longitude: -118.2437,
      }),
      { params: Promise.resolve({ id: projectId }) }
    );

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.latitude).toBe(34.0522);
    expect(updated.longitude).toBe(-118.2437);
  });

  it('GET /api/projects/:id returns latitude/longitude', async () => {
    const res = await GET(
      new Request(`http://localhost/api/projects/${projectId}`),
      { params: Promise.resolve({ id: projectId }) }
    );

    expect(res.status).toBe(200);
    const project = await res.json();
    expect(project.latitude).toBe(34.0522);
    expect(project.longitude).toBe(-118.2437);
  });
});
