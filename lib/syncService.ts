// lib/syncService.ts
import {
  getPendingWorkLogs,
  deletePendingWorkLog,
  PendingWorkLogData,
} from './indexedDBHelper';
import { dataUrlToBlob, isDataUrl, uploadImageBlob } from './imageResize';

async function uploadPendingDataUrls(images: string[] | undefined): Promise<string[] | undefined> {
  if (!images || images.length === 0) return images;
  const resolved: string[] = [];
  for (const entry of images) {
    if (isDataUrl(entry)) {
      const url = await uploadImageBlob(dataUrlToBlob(entry));
      resolved.push(url);
    } else {
      resolved.push(entry);
    }
  }
  return resolved;
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
  let successfulSyncs = 0;
  let failedSyncs = 0;

  try {
    const pendingLogs = await getPendingWorkLogs();
    console.log(`Found ${pendingLogs.length} pending work logs to sync.`);

    if (pendingLogs.length === 0) {
      return { successful: 0, failed: 0 };
    }

    // Process logs one by one
    for (const log of pendingLogs) {
      try {
        console.log(`Attempting to sync log with tempId: ${log.tempId}`);
        const apiPayload = transformPendingDataToApiPayload(log);
        apiPayload.images = await uploadPendingDataUrls(apiPayload.images);

        const response = await fetch('/api/worklogs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apiPayload),
        });

        if (response.ok) { // Check for 2xx status codes
          const result = await response.json();
          console.log(`Successfully synced log tempId: ${log.tempId}, server _id: ${result._id}`);
          // Delete from IndexedDB only after successful server confirmation
          await deletePendingWorkLog(log.tempId);
          successfulSyncs++;
        } else {
          // Handle API errors (e.g., 4xx, 5xx)
          const errorBody = await response.text(); // Read error response
          console.error(`Failed to sync log tempId: ${log.tempId}. Status: ${response.status}. Error: ${errorBody}`);
          failedSyncs++;
          // Optional: Implement retry logic or mark the log as failed in IndexedDB?
          // For now, we stop syncing on the first failure to prevent hammering
          // break;
        }
      } catch (error) {
        // Handle network errors or errors during transformation/fetch
        console.error(`Error syncing log tempId: ${log.tempId}:`, error);
        failedSyncs++;
        // Optional: Implement retry logic?
        // Stop syncing on network or unexpected errors
        // break;
      }
    }
  } catch (error) {
    console.error('Failed to retrieve pending work logs:', error);
    // Can't proceed if we can't read from IndexedDB
  }

  console.log(`Sync finished. Successful: ${successfulSyncs}, Failed: ${failedSyncs}`);
  return { successful: successfulSyncs, failed: failedSyncs };
}; 