'use client';

import { useState, useEffect } from 'react';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const useCurrentUser = () => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/auth/me');

        if (!response.ok) {
          throw new Error(`Failed to fetch current user: ${response.statusText}`);
        }

        const data = await response.json();       
        setUser(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch user';
        setError(message);
        console.error('Error fetching current user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  return { user, isLoading, error };
};
