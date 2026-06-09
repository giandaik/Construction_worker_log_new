import '@testing-library/jest-dom';
import { expect, afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Setup environment variables for tests
beforeAll(() => {
  // Set base URL for fetch calls
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';

  // NODE_ENV is already set by the test runner (vitest/jest)
  // No need to set it manually as it's read-only
});

// Mock auth context so components using useCurrentUser get a valid user in tests
vi.mock('@/components/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useCurrentUser: () => ({
    user: { userId: 'test-user-id', role: 'admin' },
    isLoading: false,
  }),
}));

// Mock fetch for API routes
const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = vi.fn((url: string | URL | Request, options?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

    // Mock /api/me endpoint
    if (urlString.includes('/api/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ userId: 'test-user-id', role: 'admin' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);
    }

    // Mock /api/projects endpoint
    if (urlString.includes('/api/projects')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [],
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);
    }

    // Mock /api/users endpoint
    if (urlString.includes('/api/users')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [],
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response);
    }

    // For other URLs, use the original fetch
    return originalFetch(url as any, options);
  }) as any;
});

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
}); 