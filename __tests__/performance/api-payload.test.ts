/**
 * Performance Tests for API Payload Optimization
 * Tests database query projections and payload size reduction
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { GET as getProjects } from '@/app/api/projects/route';
import { GET as getWorkLogs } from '@/app/api/worklogs/route';

describe('Performance: API Payload Optimization', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;

    await mongoose.connect(mongoUri);

    // Seed test data with many fields
    const db = mongoose.connection;
    await db.collection('projects').insertMany([
      {
        name: 'Project A',
        description: 'Description A',
        location: 'Location A',
        status: 'active',
        client: 'Client A',
        budget: 100000,
        startDate: new Date(),
        endDate: new Date(),
        manager: 'Manager A',
        teamMembers: ['Member 1', 'Member 2'],
        largeField: 'x'.repeat(10000), // Large field that should NOT be returned
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Project B',
        description: 'Description B',
        location: 'Location B',
        status: 'completed',
        client: 'Client B',
        budget: 200000,
        startDate: new Date(),
        endDate: new Date(),
        manager: 'Manager B',
        teamMembers: ['Member 3', 'Member 4'],
        largeField: 'y'.repeat(10000), // Large field that should NOT be returned
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await db.collection('worklogs').insertMany([
      {
        date: '2025-12-01',
        project: 'project1',
        author: 'user1',
        workDescription: 'Work description 1',
        personnel: [{ role: 'Worker', count: 5 }],
        equipment: [{ type: 'Excavator', count: 1, hours: 8 }],
        materials: [{ name: 'Concrete', quantity: 100, unit: 'kg' }],
        weather: 'Sunny',
        temperature: 25,
        notes: 'Notes here',
        largeNotesField: 'z'.repeat(10000), // Should NOT be in list endpoint
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Projects API - Payload Size', () => {
    it('should only return projected fields (_id, name, description, location, status)', async () => {
      const response = await getProjects();
      const data = await response.json();

      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);

      const project = data[0];

      // Should have these fields
      expect(project).toHaveProperty('_id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('description');
      expect(project).toHaveProperty('location');
      expect(project).toHaveProperty('status');

      // Should NOT have these fields (not projected)
      expect(project).not.toHaveProperty('client');
      expect(project).not.toHaveProperty('budget');
      expect(project).not.toHaveProperty('startDate');
      expect(project).not.toHaveProperty('endDate');
      expect(project).not.toHaveProperty('manager');
      expect(project).not.toHaveProperty('teamMembers');
      expect(project).not.toHaveProperty('largeField');
    });

    it('should have significantly reduced payload size', async () => {
      const response = await getProjects();
      const data = await response.json();
      const jsonString = JSON.stringify(data);

      // With projection, payload should be much smaller
      // Original would be >20KB with largeField, projected should be <2KB
      expect(jsonString.length).toBeLessThan(2000);
    });
  });

  describe('WorkLogs API - Payload Size', () => {
    it('should only return essential fields for list view', async () => {
      const response = await getWorkLogs(new Request('http://localhost/api/worklogs'));
      const data = await response.json();

      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);

      const workLog = data[0];

      // Should have these fields
      expect(workLog).toHaveProperty('_id');
      expect(workLog).toHaveProperty('date');
      expect(workLog).toHaveProperty('project');
      expect(workLog).toHaveProperty('author');
      expect(workLog).toHaveProperty('workDescription');

      // Should NOT have these fields (not needed in list view)
      expect(workLog).not.toHaveProperty('personnel');
      expect(workLog).not.toHaveProperty('equipment');
      expect(workLog).not.toHaveProperty('materials');
      expect(workLog).not.toHaveProperty('weather');
      expect(workLog).not.toHaveProperty('temperature');
      expect(workLog).not.toHaveProperty('notes');
      expect(workLog).not.toHaveProperty('largeNotesField');
    });

    it('should have reduced payload compared to full document', async () => {
      const response = await getWorkLogs(new Request('http://localhost/api/worklogs'));
      const data = await response.json();
      const jsonString = JSON.stringify(data);

      // Projected payload should be much smaller
      // Original would be >10KB with all arrays and largeNotesField
      expect(jsonString.length).toBeLessThan(1000);
    });
  });

  describe('Payload Reduction Metrics', () => {
    it('should demonstrate payload reduction percentage', async () => {
      const db = mongoose.connection;

      // Get full document
      const fullProjects = await db.collection('projects').find({}).toArray();
      const fullSize = JSON.stringify(fullProjects).length;

      // Get projected document
      const response = await getProjects();
      const projectedData = await response.json();
      const projectedSize = JSON.stringify(projectedData).length;

      const reduction = ((fullSize - projectedSize) / fullSize) * 100;

      // Should have at least 40% reduction
      expect(reduction).toBeGreaterThan(40);

      console.log(`
        📊 Payload Reduction Metrics:
        - Full payload: ${fullSize} bytes
        - Projected payload: ${projectedSize} bytes
        - Reduction: ${reduction.toFixed(2)}%
      `);
    });
  });
});
