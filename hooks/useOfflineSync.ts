import { useCallback } from 'react';
import { useCurrentUser } from '@/components/auth-context';
import { v4 as uuidv4 } from 'uuid';
import { addPendingWorkLog, PendingWorkLogData } from '@/lib/indexedDBHelper';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './useToast';
import { TOAST_DURATION } from '@/lib/constants/constants';
import { dataUrlToBlob, isDataUrl, uploadImageBlob } from '@/lib/imageResize';
import type { WorkLogFormData } from './useWorkLogForm';

async function resolveImageUrls(images: string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const entry of images) {
    if (isDataUrl(entry)) {
      resolved.push(await uploadImageBlob(dataUrlToBlob(entry)));
    } else {
      resolved.push(entry);
    }
  }
  return resolved;
}

/**
 * Options for submitting work log data
 */
interface SubmitOptions {
  onlineSubmit: (data: any) => Promise<void>;
  formData: WorkLogFormData;
}

/**
 * Custom hook to handle offline/online submission logic
 * Abstracts the complexity of determining whether to save locally or submit to server
 */
export function useOfflineSync() {
  const { user } = useCurrentUser();
  const isOnline = useOnlineStatus();
  const { showSuccess, showError } = useToast();

  const submitWorkLog = useCallback(async ({
    onlineSubmit,
    formData,
  }: SubmitOptions) => {
    if (!user?.userId) {
      const errorMsg = 'User not authenticated. Please sign in to submit work logs.';
      showError(errorMsg);
      throw new Error(errorMsg);
    }

    const authorId = user.userId;

    if (isOnline) {
      // Online submission
      try {
        const images = await resolveImageUrls(formData.images || []);

        const apiData = {
          ...formData,
          images,
          date: new Date(formData.date),
          author: authorId
        };

        await onlineSubmit(apiData);
        showSuccess('Work log submitted successfully', TOAST_DURATION.SHORT);
      } catch (error) {
        console.error('Online submission error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showError(`Failed to submit: ${errorMessage}`);
        throw error;
      }
    } else {
      // Offline submission - save to IndexedDB
      const tempId = uuidv4();

      const pendingData: PendingWorkLogData = {
        tempId,
        author: authorId,
        date: new Date(formData.date).toISOString(),
        project: formData.project,
        weather: formData.weather,
        temperature: formData.temperature,
        workDescription: formData.workDescription,
        personnel: formData.personnel,
        equipment: formData.equipment,
        materials: formData.materials,
        notes: formData.notes,
        images: formData.images,
      };

      try {
        await addPendingWorkLog(pendingData);
        showSuccess('Work log saved locally. Will sync when online.', TOAST_DURATION.MEDIUM);
      } catch (error) {
        console.error('Error saving pending work log:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showError(`Failed to save locally: ${errorMessage}`);
        throw error;
      }
    }
  }, [user, isOnline, showSuccess, showError]);

  return {
    isOnline,
    submitWorkLog,
  };
}
