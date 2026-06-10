import { useMemo } from 'react';

export type ProjectRole = 'owner' | 'contractor' | null;

export function useProjectRole(
  userId?: string,
  projectOwnerUserId?: string,
  projectContractorUserId?: string
): ProjectRole {
  return useMemo(() => {

    if (!userId) return null;

    if (userId === projectOwnerUserId) return 'owner';
    if (userId === projectContractorUserId) return 'contractor';


    return null;
  }, [userId, projectOwnerUserId, projectContractorUserId]);
}