import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkLogForm } from '../components/WorkLogForm';
import dbConnect from '../lib/dbConnect';
import { WorkLog, Project, User } from '../lib/models';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * The form is client-side and loads its project list through `apiFetch`.
 * jsdom has no server to answer that call, so stub the client module: without
 * it the component stays on the "Loading sites…" step and renders no field to
 * assert on.
 */
const PROJECT_ID = '66f1a2b3c4d5e6f7a8b9c0d1';

vi.mock('@/lib/apiClient', () => {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  return {
    apiUrl: (path: string) => path,
    isCrossOriginApi: () => false,
    apiFetch: vi.fn(async (path: string) => {
      if (path === '/api/projects') {
        return json([
          {
            _id: PROJECT_ID,
            name: 'Test Project',
            description: 'Test Description',
            location: 'Test Location',
            startDate: new Date().toISOString(),
            status: 'in-progress',
          },
        ]);
      }
      return json({});
    }),
  };
});

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  // Temporarily set the MONGODB_URI for the test
  process.env.MONGODB_URI = mongoUri;
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

const renderWithSession = (component: React.ReactElement) => render(component);

/** The guided flow opens on "Which site today?" — pick the site to reach the form. */
async function selectProject() {
  const site = await screen.findByRole('button', { name: /Test Project/i });
  fireEvent.click(site);
}

describe('WorkLogForm', () => {
  const mockManagerId = new mongoose.Types.ObjectId();
  const mockProjectId = new mongoose.Types.ObjectId(PROJECT_ID);
  const mockProject = {
    _id: mockProjectId,
    name: 'Test Project',
    description: 'Test Description',
    location: 'Test Location',
    startDate: new Date(),
    endDate: new Date(),
    status: 'in-progress' as const,
    manager: mockManagerId,
    ownerEmail: 'owner@example.com',
    contractorEmail: 'contractor@example.com',
    ownerUserId: mockManagerId,
    contractorUserId: mockManagerId,
  };

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test User',
    email: 'test@example.com',
    password: 'not-a-real-hash',
    role: 'admin' as const,
  };

  it('should render the form correctly', async () => {
    await Project.create(mockProject);
    await User.create(mockUser);

    renderWithSession(<WorkLogForm onSubmit={vi.fn()} />);

    await selectProject();

    await waitFor(() => {
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/work description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add personnel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add equipment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add material/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit work log/i })).toBeInTheDocument();
  });

  it('should handle personnel addition', async () => {
    await Project.create(mockProject);
    await User.create(mockUser);

    renderWithSession(<WorkLogForm onSubmit={vi.fn()} />);
    await selectProject();

    const addButton = await screen.findByRole('button', { name: /add personnel/i });
    fireEvent.click(addButton);

    // Check if personnel fields appear
    await waitFor(() => {
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    });
  });

  it('should handle equipment addition', async () => {
    await Project.create(mockProject);
    await User.create(mockUser);

    renderWithSession(<WorkLogForm onSubmit={vi.fn()} />);
    await selectProject();

    const addButton = await screen.findByRole('button', { name: /add equipment/i });
    fireEvent.click(addButton);

    // Check if equipment fields appear
    await waitFor(() => {
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    });
  });

  it('should handle material addition', async () => {
    await Project.create(mockProject);
    await User.create(mockUser);

    renderWithSession(<WorkLogForm onSubmit={vi.fn()} />);
    await selectProject();

    const addButton = await screen.findByRole('button', { name: /add material/i });
    fireEvent.click(addButton);

    // Check if material fields appear
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });
  });
});
