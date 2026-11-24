import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import WorkLog, { IWorkLog } from '../lib/models/WorkLog';
import Project, { IProject } from '../lib/models/Project';
import User, { IUser } from '../lib/models/User';

/**
 * The API tests below drive the real route handlers, so only `getAuthUser` is
 * faked; the tenant context derivation the routes rely on runs for real.
 */
const { TENANT_ID, mockGetAuthUser } = vi.hoisted(() => ({
  TENANT_ID: '507f1f77bcf86cd799439011',
  mockGetAuthUser: vi.fn(),
}));

vi.mock('@/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/auth')>();
  return { ...actual, getAuthUser: mockGetAuthUser };
});

import { GET, POST } from '../app/api/worklogs/route';

// Import the Cached interface from dbConnect
interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend global type for mongoose cache (must match dbConnect.ts)
declare global {
  // eslint-disable-next-line no-var
  var mongoose: Cached | undefined;
}

const TENANT_OBJECT_ID = new Types.ObjectId(TENANT_ID);

describe('WorkLog Tests', () => {
  let mongoServer: MongoMemoryServer;
  let defaultProject: IProject;
  let defaultUser: IUser;

  beforeEach(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Set MONGODB_URI for dbConnect to use
    process.env.MONGODB_URI = mongoUri;

    await mongoose.connect(mongoUri);

    // Create test user
    defaultUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'not-a-real-hash',
      role: 'manager',
    });

    // Create test project
    defaultProject = await Project.create({
      name: 'Test Project',
      description: 'Test Project Description',
      location: 'Test Location',
      startDate: new Date(),
      status: 'in-progress',
      ownerEmail: 'owner@example.com',
      contractorEmail: 'contractor@example.com',
      ownerUserId: defaultUser._id,
      contractorUserId: defaultUser._id,
      manager: defaultUser._id,
      tenantId: TENANT_OBJECT_ID,
    });

    mockGetAuthUser.mockResolvedValue({
      userId: (defaultUser._id as Types.ObjectId).toString(),
      name: 'Test User',
      role: 'manager',
      tenantId: TENANT_ID,
    } as any);
  });

  afterEach(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();

    // Clear the global mongoose cache to prevent connection reuse
    if (global.mongoose) {
      global.mongoose.conn = null;
      global.mongoose.promise = null;
    }

    // Clean up MONGODB_URI
    delete process.env.MONGODB_URI;
  });

  describe('Saving WorkLogs', () => {
    it('should save a valid work log', async () => {
      const workLogData: Partial<IWorkLog> = {
        tenantId: TENANT_OBJECT_ID,
        date: new Date(),
        project: defaultProject._id as Types.ObjectId,
        author: defaultUser._id as Types.ObjectId,
        weather: 'Sunny',
        temperature: 25,
        workDescription: 'Test work description',
        personnel: [
          { role: 'Worker', count: 5, workDetails: '' }
        ],
        equipment: [
          { type: 'Excavator', count: 1, hours: 8 }
        ],
        materials: [
          { name: 'Concrete', quantity: 10, unit: 'cubic meters' }
        ],
        notes: 'Test notes'
      };

      const workLog = new WorkLog(workLogData);
      const savedWorkLog = await workLog.save();

      expect(savedWorkLog._id).toBeDefined();
      expect(savedWorkLog.project.toString()).toBe((defaultProject._id as Types.ObjectId).toString());
      expect(savedWorkLog.workDescription).toBe('Test work description');
    });

    it('should fail to save work log without required fields', async () => {
      const invalidWorkLog = new WorkLog({
        // Missing required fields
        weather: 'Sunny'
      });

      await expect(invalidWorkLog.save()).rejects.toThrow();
    });

    it('refuses to save a work log with no tenant, so it can never leak across tenants', async () => {
      const orphan = new WorkLog({
        date: new Date(),
        project: defaultProject._id as Types.ObjectId,
        author: defaultUser._id as Types.ObjectId,
        workDescription: 'No tenant',
      });

      await expect(orphan.save()).rejects.toThrow(/tenantId/);
    });
  });

  describe('Retrieving WorkLogs', () => {
    beforeEach(async () => {
      // Create some test work logs
      const workLogs: Partial<IWorkLog>[] = [
        {
          tenantId: TENANT_OBJECT_ID,
          date: new Date('2024-03-01'),
          project: defaultProject._id as Types.ObjectId,
          author: defaultUser._id as Types.ObjectId,
          workDescription: 'Work Log 1',
          personnel: [{ role: 'Worker', count: 3, workDetails: '' }]
        },
        {
          tenantId: TENANT_OBJECT_ID,
          date: new Date('2024-03-02'),
          project: defaultProject._id as Types.ObjectId,
          author: defaultUser._id as Types.ObjectId,
          workDescription: 'Work Log 2',
          personnel: [{ role: 'Worker', count: 4, workDetails: '' }]
        }
      ];

      await WorkLog.insertMany(workLogs);
    });

    it('should retrieve all work logs', async () => {
      const workLogs = await WorkLog.find({})
        .populate('project', 'name')
        .populate('author', 'name');

      expect(workLogs).toHaveLength(2);
      expect(workLogs[0].project.name).toBe('Test Project');
      expect(workLogs[0].author.name).toBe('Test User');
    });

    it('should retrieve work log by ID', async () => {
      const workLog = await WorkLog.findOne({});
      const retrievedWorkLog = await WorkLog.findById(workLog?._id)
        .populate('project')
        .populate('author');

      expect(retrievedWorkLog).toBeDefined();
      expect(retrievedWorkLog?.workDescription).toBe('Work Log 1');
    });

    it('should sort work logs by date', async () => {
      const workLogs = await WorkLog.find({})
        .sort({ date: -1 });

      expect(workLogs[0].date.getTime()).toBeGreaterThan(workLogs[1].date.getTime());
    });
  });

  describe('API Route Tests', () => {
    it('should handle POST request to create work log', async () => {
      const requestData = {
        date: new Date(),
        project: (defaultProject._id as Types.ObjectId).toString(),
        author: (defaultUser._id as Types.ObjectId).toString(),
        workDescription: 'API Test Work Log',
        personnel: [{ role: 'Worker', count: 2, workDetails: '' }]
      };

      const request = new Request('http://localhost:3000/api/worklogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data._id).toBeDefined();
      expect(data.workDescription).toBe('API Test Work Log');
      expect(data.tenantId).toBe(TENANT_ID);
    });

    it('should reject an unauthenticated POST, so tenantId cannot come from the client', async () => {
      mockGetAuthUser.mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/worklogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workDescription: 'Anon' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should handle GET request to fetch work logs', async () => {
      await WorkLog.create({
        tenantId: TENANT_OBJECT_ID,
        date: new Date('2024-04-01'),
        project: defaultProject._id as Types.ObjectId,
        author: defaultUser._id as Types.ObjectId,
        workDescription: 'Listed Work Log',
      });

      const response = await GET(new Request('http://localhost:3000/api/worklogs'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].workDescription).toBe('Listed Work Log');
    });
  });
});
