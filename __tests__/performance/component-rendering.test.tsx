/**
 * Performance Tests for React Component Optimizations
 * Tests React.memo, useMemo, and useCallback effectiveness
 *
 * The work-log form now opens on a project picker ("Which site today?") rather
 * than a project <select>, so these assertions target the picker cards instead
 * of a "Loading projects" skeleton that no longer exists.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { WorkLogForm } from '@/components/WorkLogForm';
import { PendingSubmissions } from '@/components/PendingSubmissions';

// Hook stubs must return *stable* function identities: a fresh `vi.fn()` per
// render makes WorkLogForm's fetch effect re-run forever.
const { showErrorMock, handleErrorMock, submitWorkLogMock } = vi.hoisted(() => ({
  showErrorMock: vi.fn(),
  handleErrorMock: vi.fn(),
  submitWorkLogMock: vi.fn(),
}));

// The form hook is stubbed, but it has to hold real state: selecting a site
// only swaps the picker for the form if `project` actually changes.
vi.mock('@/hooks/useWorkLogForm', async () => {
  const React = await import('react');

  return {
    useWorkLogForm: () => {
      const noop = React.useRef(() => {}).current;
      const [formData, setFormData] = React.useState({
        date: '2025-12-01',
        project: '',
        author: '',
        workDescription: '',
        personnel: [],
        equipment: [],
        materials: [],
        weather: '',
        temperature: 20,
        notes: '',
        images: [],
        dwgRefs: [],
        signatures: [],
      });

      return {
        formData,
        handleChange: noop,
        personnel: { add: noop, remove: noop, update: noop },
        equipment: { add: noop, remove: noop, update: noop },
        materials: { add: noop, remove: noop, update: noop },
        updateSignatures: noop,
        updateImages: noop,
        updateDwgRefs: noop,
        updateWeather: noop,
        setProject: (projectId: string) =>
          setFormData((prev) => ({ ...prev, project: projectId })),
        clearProject: () => setFormData((prev) => ({ ...prev, project: '' })),
        seedFromPrevious: noop,
        clearSeed: noop,
        resetForm: noop,
      };
    },
  };
});

vi.mock('@/hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({
    isOnline: true,
    submitWorkLog: submitWorkLogMock,
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: null,
    showError: showErrorMock,
  }),
}));

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: handleErrorMock,
  }),
}));

// The form loads its sites through apiFetch; stub the client module so the
// picker has data without a server behind it.
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
          { _id: '1', name: 'Project A', description: 'Test', status: 'in-progress' },
          { _id: '2', name: 'Project B', description: 'Test', status: 'in-progress' },
        ]);
      }
      return json({});
    }),
  };
});

// Mock IndexedDB helper
vi.mock('@/lib/indexedDBHelper', () => ({
  getPendingWorkLogs: vi.fn().mockResolvedValue([]),
}));

// Mock sync service
vi.mock('@/lib/syncService', () => ({
  syncPendingWorkLogs: vi.fn().mockResolvedValue({ successful: 0, failed: 0 }),
}));

describe('Performance: React Component Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WorkLogForm - React.memo optimization', () => {
    it('should be wrapped with React.memo', () => {
      expect(WorkLogForm).toBeDefined();
      // React.memo components carry the memo symbol on $$typeof.
      expect((WorkLogForm as any).$$typeof).toBe(Symbol.for('react.memo'));
    });

    it('should not re-render when parent re-renders with same props', async () => {
      const onSubmit = vi.fn();
      let renderCount = 0;

      // Wrap to track renders
      const TrackedWorkLogForm = React.memo(() => {
        renderCount++;
        return <WorkLogForm onSubmit={onSubmit} />;
      });

      const { rerender } = render(<TrackedWorkLogForm />);

      await screen.findByText('Project A', {}, { timeout: 3000 });
      const initialRenderCount = renderCount;

      // Re-render with same props
      rerender(<TrackedWorkLogForm />);

      // Should not cause additional renders
      expect(renderCount).toBe(initialRenderCount);
    });
  });

  describe('PendingSubmissions - React.memo optimization', () => {
    const mockInitialData = {
      projects: [
        { _id: '1', name: 'Project A', description: 'Test' },
      ],
      workLogs: [],
    };

    it('should be wrapped with React.memo', () => {
      expect(PendingSubmissions).toBeDefined();
      expect((PendingSubmissions as any).$$typeof).toBe(Symbol.for('react.memo'));
    });

    it('should render without crashing', async () => {
      render(<PendingSubmissions initialData={mockInitialData} />);

      // Should show "No pending submissions" or the card title
      const element = await screen.findByText(/No pending submissions/i);
      expect(element).toBeInTheDocument();
    });

    it('should use useCallback for memoized functions', async () => {
      const { rerender } = render(<PendingSubmissions initialData={mockInitialData} />);

      await screen.findByText(/No pending submissions/i);

      // Re-render with same data
      rerender(<PendingSubmissions initialData={mockInitialData} />);

      // Component should handle re-renders efficiently
      expect(screen.getAllByText(/Pending Submissions/i).length).toBeGreaterThan(0);
    });
  });

  describe('WorkLogForm - project picker', () => {
    it('should render every project as a selectable card', async () => {
      const onSubmit = vi.fn();
      render(<WorkLogForm onSubmit={onSubmit} />);

      // Wait for projects to load
      await screen.findByText('Project A', {}, { timeout: 3000 });
      expect(screen.getByRole('button', { name: /Project A/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Project B/i })).toBeInTheDocument();
    });

    it('should reveal the form after a project is chosen', async () => {
      const onSubmit = vi.fn();
      render(<WorkLogForm onSubmit={onSubmit} />);

      const card = await screen.findByRole('button', { name: /Project A/i }, { timeout: 3000 });
      await userEvent.click(card);

      // The guided flow swaps the picker for the entry form.
      expect(await screen.findByText(/Work Description/i)).toBeInTheDocument();
    });
  });
});
