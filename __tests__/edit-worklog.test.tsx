import React from 'react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dbConnect from '../lib/dbConnect';

// Mock next/navigation
const mockRouterPush = vi.fn();
const mockRouterBack = vi.fn();
const mockParams = { id: '507f1f77bcf86cd799439011' }; // Valid MongoDB ObjectId

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
  }),
  useParams: () => mockParams,
}));

// Mock data-fetchers
const mockProjects = [
  { _id: '507f1f77bcf86cd799439012', name: 'Project A' },
  { _id: '507f1f77bcf86cd799439013', name: 'Project B' },
];

const mockUsers = [
  { _id: '507f1f77bcf86cd799439014', name: 'User A', email: 'usera@example.com' },
  { _id: '507f1f77bcf86cd799439015', name: 'User B', email: 'userb@example.com' },
];

vi.mock('../lib/data-fetchers', () => ({
  fetchProjects: vi.fn(() => Promise.resolve(mockProjects)),
  fetchUsers: vi.fn(() => Promise.resolve(mockUsers)),
}));

// Mock sonner toast
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;
  await dbConnect();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('EditWorkLogForm', () => {
  const mockWorkLog = {
    _id: '507f1f77bcf86cd799439011',
    date: '2025-12-01',
    project: '507f1f77bcf86cd799439012',
    author: '507f1f77bcf86cd799439014',
    workDescription: 'Foundation work completed',
    weather: 'Sunny',
    temperature: 22,
    personnel: [
      { role: 'Mason', count: 3, workDetails: 'Bricklaying' },
    ],
    equipment: [
      { type: 'Excavator', count: 1, hours: 8 },
    ],
    materials: [
      { name: 'Concrete', quantity: 50, unit: 'cubic meters' },
    ],
    notes: 'Weather was favorable',
    signatures: [
      {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        signedBy: 'John Doe',
        signedAt: new Date('2025-12-01T10:00:00Z'),
        role: 'Site Supervisor',
      },
    ],
  };

  // Setup fetch mock before each test
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/worklogs/')) {
        if (url.includes('PUT') || (global.fetch as any).mock.calls[0]?.[1]?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...mockWorkLog, workDescription: 'Updated description' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockWorkLog),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });
    }) as any;
  });

  it('should load and display existing work log data', async () => {
    // Dynamic import to ensure mocks are in place
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify form fields are populated
    await waitFor(() => {
      const descriptionField = screen.getByRole('textbox', { name: /details/i }) as HTMLTextAreaElement;
      expect(descriptionField.value).toBe('Foundation work completed');
    });

    const weatherField = screen.getByRole('textbox', { name: /weather/i }) as HTMLInputElement;
    expect(weatherField.value).toBe('Sunny');

    const temperatureField = screen.getByRole('spinbutton', { name: /temperature/i }) as HTMLInputElement;
    expect(temperatureField.value).toBe('22');
  });

  it('should display existing personnel data', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Check personnel section
    await waitFor(() => {
      const roleInputs = screen.getAllByPlaceholderText(/role/i);
      expect(roleInputs.length).toBeGreaterThan(0);
      expect((roleInputs[0] as HTMLInputElement).value).toBe('Mason');
    });
  });

  it('should display existing equipment data', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Check equipment section
    await waitFor(() => {
      const typeInputs = screen.getAllByPlaceholderText(/type/i);
      expect(typeInputs.length).toBeGreaterThan(0);
      expect((typeInputs[0] as HTMLInputElement).value).toBe('Excavator');
    });
  });

  it('should display existing materials data', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Check materials section
    await waitFor(() => {
      const nameInputs = screen.getAllByPlaceholderText(/name/i);
      const concreteInput = nameInputs.find(
        (input) => (input as HTMLInputElement).value === 'Concrete'
      );
      expect(concreteInput).toBeTruthy();
    });
  });

  it('should display existing signatures', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Check signatures section
    await waitFor(() => {
      expect(screen.getByText(/signatures/i)).toBeInTheDocument();
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      expect(screen.getByText(/site supervisor/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should allow adding new personnel', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Find and click Add Personnel button
    const addPersonnelButton = screen.getByRole('button', { name: /add personnel/i });
    fireEvent.click(addPersonnelButton);

    // Verify new personnel row is added
    await waitFor(() => {
      const roleInputs = screen.getAllByPlaceholderText(/role/i);
      expect(roleInputs.length).toBeGreaterThan(1);
    });
  });

  it('should allow adding new equipment', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Find and click Add Equipment button
    const addEquipmentButton = screen.getByRole('button', { name: /add equipment/i });
    fireEvent.click(addEquipmentButton);

    // Verify new equipment row is added
    await waitFor(() => {
      const typeInputs = screen.getAllByPlaceholderText(/type/i);
      expect(typeInputs.length).toBeGreaterThan(1);
    });
  });

  it('should allow adding new materials', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Find and click Add Material button
    const addMaterialButton = screen.getByRole('button', { name: /add material/i });
    fireEvent.click(addMaterialButton);

    // Verify new material row is added
    await waitFor(() => {
      const nameInputs = screen.getAllByPlaceholderText(/name/i);
      expect(nameInputs.length).toBeGreaterThan(1);
    });
  });

  it('should update work log on form submission', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Update work description
    const descriptionField = screen.getByRole('textbox', { name: /details/i });
    await userEvent.clear(descriptionField);
    await userEvent.type(descriptionField, 'Updated description');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /update work log/i });
    fireEvent.click(submitButton);

    // Verify API was called with updated data
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/worklogs/507f1f77bcf86cd799439011'),
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });
  });

  it('should navigate back on cancel button click', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Find and click Cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Verify router.back() was called
    expect(mockRouterBack).toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    // Override fetch to return error
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to fetch work log' }),
      })
    ) as any;

    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    // Wait for error handling
    await waitFor(() => {
      // The form should still render even with error (showing loading state)
      expect(screen.getByText(/loading form/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should validate required fields before submission', async () => {
    const { default: EditWorkLogForm } = await import('../app/worklogs/[id]/edit/page');

    render(<EditWorkLogForm />);

    await waitFor(() => {
      expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Clear work description (required field)
    const descriptionField = screen.getByRole('textbox', { name: /details/i });
    await userEvent.clear(descriptionField);

    // Try to submit
    const submitButton = screen.getByRole('button', { name: /update work log/i });
    fireEvent.click(submitButton);

    // Verify error message appears or form doesn't submit
    await waitFor(() => {
      // The form should show validation error or not call the API
      const fetchCalls = (global.fetch as any).mock.calls.filter(
        (call: any) => call[1]?.method === 'PUT'
      );
      // Either no PUT calls or validation error shown
      expect(fetchCalls.length === 0 || screen.queryByText(/required/i)).toBeTruthy();
    });
  });
});
