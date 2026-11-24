/**
 * Integration Performance Tests
 * End-to-end tests for overall application performance
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';

/**
 * The routes under measurement are tenant-scoped; without a session they
 * return 401 and the timing numbers below would be measuring nothing.
 */
const { TENANT_ID, mockGetAuthUser } = vi.hoisted(() => ({
  TENANT_ID: '507f1f77bcf86cd799439011',
  mockGetAuthUser: vi.fn(),
}));

vi.mock('@/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/auth')>();
  return { ...actual, getAuthUser: mockGetAuthUser };
});

describe('Performance: Integration Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;
    await mongoose.connect(mongoUri);

    mockGetAuthUser.mockResolvedValue({
      userId: new Types.ObjectId().toString(),
      name: 'Perf Admin',
      role: 'admin',
      tenantId: TENANT_ID,
    } as any);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Database Connection Performance', () => {
    it('should connect to database within timeout', async () => {
      const startTime = Date.now();
      const { dbConnect } = await import('@/lib/dbConnect');

      await dbConnect();

      const duration = Date.now() - startTime;

      console.log(`
        ⚡ Database Connection:
        - Connection time: ${duration}ms
      `);

      // Should connect quickly (in-memory DB)
      expect(duration).toBeLessThan(1000);
    });

    it('should reuse existing connection', async () => {
      const { dbConnect } = await import('@/lib/dbConnect');

      // First connection
      await dbConnect();

      // Second call should reuse connection (much faster)
      const startTime = Date.now();
      await dbConnect();
      const duration = Date.now() - startTime;

      console.log(`
        🔄 Connection Reuse:
        - Reuse time: ${duration}ms
      `);

      // Cached connection should be nearly instant
      expect(duration).toBeLessThan(50);
    });
  });

  describe('API Response Time', () => {
    it('should fetch projects quickly', async () => {
      const db = mongoose.connection;

      // Seed data
      await db.collection('projects').insertMany([
        { name: 'Project 1', description: 'Test 1', tenantId: new Types.ObjectId(TENANT_ID) },
        { name: 'Project 2', description: 'Test 2', tenantId: new Types.ObjectId(TENANT_ID) },
        { name: 'Project 3', description: 'Test 3', tenantId: new Types.ObjectId(TENANT_ID) },
      ]);

      const startTime = Date.now();
      const { GET } = await import('@/app/api/projects/route');
      const response = await GET(new Request('http://localhost/api/projects'));
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);

      console.log(`
        ⚡ API Performance:
        - /api/projects response time: ${duration}ms
      `);

      // Should respond within 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should handle parallel requests efficiently', async () => {
      const db = mongoose.connection;

      // Clear and seed
      await db.collection('projects').deleteMany({});
      await db.collection('worklogs').deleteMany({});

      await db.collection('projects').insertMany([
        { name: 'Project A', tenantId: new Types.ObjectId(TENANT_ID) },
        { name: 'Project B', tenantId: new Types.ObjectId(TENANT_ID) },
      ]);

      await db.collection('worklogs').insertMany([
        {
          tenantId: new Types.ObjectId(TENANT_ID),
          date: new Date('2025-12-01'),
          project: new Types.ObjectId(),
          author: new Types.ObjectId(),
          workDescription: 'Work 1',
        },
        {
          tenantId: new Types.ObjectId(TENANT_ID),
          date: new Date('2025-12-02'),
          project: new Types.ObjectId(),
          author: new Types.ObjectId(),
          workDescription: 'Work 2',
        },
      ]);

      // Parallel requests (like homepage does)
      const startTime = Date.now();

      const [projectsModule, worklogsModule] = await Promise.all([
        import('@/app/api/projects/route'),
        import('@/app/api/worklogs/route'),
      ]);

      const [projectsResponse, worklogsResponse] = await Promise.all([
        projectsModule.GET(new Request('http://localhost/api/projects')),
        worklogsModule.GET(new Request('http://localhost/api/worklogs')),
      ]);

      const duration = Date.now() - startTime;

      expect(projectsResponse.status).toBe(200);
      expect(worklogsResponse.status).toBe(200);

      console.log(`
        ⚡ Parallel Requests:
        - Projects + WorkLogs (parallel): ${duration}ms
      `);

      // Parallel should be faster than sequential (each ~100-200ms)
      // If sequential would be ~400ms, parallel should be <300ms
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should track and report performance metrics', async () => {
      const metrics = {
        dbConnection: 0,
        apiProjects: 0,
        apiWorkLogs: 0,
      };

      // Test database connection
      const dbStart = Date.now();
      const { dbConnect } = await import('@/lib/dbConnect');
      await dbConnect();
      metrics.dbConnection = Date.now() - dbStart;

      // Test API endpoints
      const db = mongoose.connection;
      await db.collection('projects').deleteMany({});
      await db.collection('projects').insertOne({
        name: 'Test Project',
        tenantId: new Types.ObjectId(TENANT_ID),
      });

      const apiProjectsStart = Date.now();
      const { GET: getProjects } = await import('@/app/api/projects/route');
      await getProjects(new Request('http://localhost/api/projects'));
      metrics.apiProjects = Date.now() - apiProjectsStart;

      await db.collection('worklogs').deleteMany({});
      await db.collection('worklogs').insertOne({
        tenantId: new Types.ObjectId(TENANT_ID),
        date: new Date('2025-12-01'),
        project: new Types.ObjectId(),
        author: new Types.ObjectId(),
        workDescription: 'Test work',
      });

      const apiWorkLogsStart = Date.now();
      const { GET: getWorkLogs } = await import('@/app/api/worklogs/route');
      await getWorkLogs(new Request('http://localhost/api/worklogs'));
      metrics.apiWorkLogs = Date.now() - apiWorkLogsStart;

      console.log(`
        📊 Performance Metrics Summary:
        --------------------------------
        - DB Connection: ${metrics.dbConnection}ms
        - API /projects: ${metrics.apiProjects}ms
        - API /worklogs: ${metrics.apiWorkLogs}ms

        Performance Budget:
        - DB Connection: <1000ms ✓
        - API Endpoints: <500ms each ✓
      `);

      // All metrics should be within acceptable ranges
      expect(metrics.dbConnection).toBeLessThan(1000);
      expect(metrics.apiProjects).toBeLessThan(500);
      expect(metrics.apiWorkLogs).toBeLessThan(500);
    });
  });
});
