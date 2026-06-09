// lib/syncService.ts
import {
  getPendingWorkLogs,
  deletePendingWorkLog,
  PendingWorkLogData,
} from './indexedDBHelper';
import { dataUrlToBlob, isDataUrl, uploadImageBlob } from './imageResize';

async function uploadPendingDataUrls(images: string[] | undefined): Promise<string[] | undefined> {
  if (!images || images.length === 0) return images;
  return Promise.all(
    images.map((entry) =>
      isDataUrl(entry) ? uploadImageBlob(dataUrlToBlob(entry)) : Promise.resolve(entry),
    ),
  );
}

/**
 * API payload interface for creating work logs
 * Matches the database schema - no transformation needed
 */
interface WorkLogApiPayload {
  date: Date | string;
  project: string; // ObjectId as string
  author: string; // ObjectId as string
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel: Array<{ role: string; count: number }>;
  equipment: Array<{ type: string; count: number; hours?: number }>;
  materials: Array<{ name: string; quantity: number; unit: string }>;
  issues?: string;
  notes?: string;
  images?: string[];
}

/**
 * Converts pending data to API payload
 * Since schemas now match, this is just a simple conversion
 */
const transformPendingDataToApiPayload = (pendingData: PendingWorkLogData): WorkLogApiPayload => {
  const { tempId, ...apiPayload } = pendingData;

  // Convert date string to Date object
  return {
    ...apiPayload,
    date: new Date(apiPayload.date),
  };
};


// Attempts to sync all pending work logs with the server
export const syncPendingWorkLogs = async (): Promise<{ successful: number; failed: number }> => {
  try {
    const pendingLogs = await getPendingWorkLogs();
    if (pendingLogs.length === 0) return { successful: 0, failed: 0 };

    const results = await Promise.allSettled(
      pendingLogs.map(async (log) => {
        const apiPayload = transformPendingDataToApiPayload(log);
        apiPayload.images = await uploadPendingDataUrls(apiPayload.images);

        const response = await fetch('/api/worklogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Status ${response.status}: ${errorBody}`);
        }

        await deletePendingWorkLog(log.tempId);
      }),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Failed to sync log ${pendingLogs[i].tempId}:`, r.reason);
      }
    });

    return { successful, failed };
  } catch (error) {
    console.error('Failed to retrieve pending work logs:', error);
    return { successful: 0, failed: 0 };
  }
}; 