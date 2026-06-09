import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkLogForm } from '../components/WorkLogForm';
import dbConnect from '../lib/dbConnect';
import { WorkLog, Project, User } from '../lib/models';
import type { IProject, IUser } from '../lib/models';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

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

describe('WorkLogForm', () => {
  const mockManagerId = new mongoose.Types.ObjectId();
  const mockProjectId = new mongoose.Types.ObjectId();
  const mockProject = {
    _id: mockProjectId,
    name: 'Test Project',
    description: 'Test Description',
    location: 'Test Location',
    startDate: new Date(),
    endDate: new Date(),
    status: 'in-progress' as const,
    manager: mockManagerId,
  };

  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin' as const,
  };

  it('should render the form correctly', async () => {
    await Project.create(mockProject);
    await User.create(mockUser);

    renderWithSession(<WorkLogForm onSubmit={vi.fn()} />);

    // Wait for async operations to complete
    await waitFor(() => {
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    });

    // Check if form elements are rendered
    expect(screen.getByLabelText(/project/i)).toBeInTheDocument();
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

    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add personnel/i })).toBeInTheDocument();
    });

    // Add personnel
    const addButton = screen.getByRole('button', { name: /add personnel/i });
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

    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add equipment/i })).toBeInTheDocument();
    });

    // Add equipment
    const addButton = screen.getByRole('button', { name: /add equipment/i });
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

    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add material/i })).toBeInTheDocument();
    });

    // Add material
    const addButton = screen.getByRole('button', { name: /add material/i });
    fireEvent.click(addButton);

    // Check if material fields appear
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });
  });
}); 