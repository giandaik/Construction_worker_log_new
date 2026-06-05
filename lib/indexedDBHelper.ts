// lib/indexedDBHelper.ts

const DB_NAME = 'ConstructionLogDB';
const STORE_NAME = 'pendingWorkLogs';
const DB_VERSION = 2; // Incremented for schema change

let db: IDBDatabase | null = null;

/**
 * Pending WorkLog data structure for offline storage
 * Matches the database schema to eliminate transformation logic
 * IDs are stored as strings for IndexedDB compatibility
 */
export interface PendingWorkLogData {
  tempId: string; // Client-side temporary ID
  author: string; // User ObjectId as string
  date: string; // ISO string format
  project: string; // Project ObjectId as string
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel: Array<{ role: string; count: number }>;
  equipment: Array<{ type: string; count: number; hours?: number }>;
  materials: Array<{ name: string; quantity: number; unit: string }>;
  issues?: string;
  notes?: string;
  images?: string[];
  status?: string; // "pending" or "signed"
  signatures?: Array<{
    data: string;
    signedBy: string;
    signedAt: string | Date;
    role?: string;
  }>;
}


// Initialize the IndexedDB database
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error);
      reject("Error opening IndexedDB");
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      console.log("IndexedDB opened successfully");
      resolve(db);
    };

    // This event only executes if the version number changes
    request.onupgradeneeded = (event) => {
      const tempDb = (event.target as IDBOpenDBRequest).result;
      if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
        // Create object store with 'tempId' as the key path
        tempDb.createObjectStore(STORE_NAME, { keyPath: 'tempId' });
        console.log("Object store 'pendingWorkLogs' created");
      }
      // Handle future schema upgrades here if needed
    };
  });
};

// Add a pending work log to the object store
export const addPendingWorkLog = async (workLogData: PendingWorkLogData): Promise<void> => {
  const currentDb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = currentDb.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(workLogData);

    request.onsuccess = () => {
      console.log(`Pending work log added with tempId: ${workLogData.tempId}`);
      resolve();
    };

    request.onerror = (event) => {
      console.error("Error adding pending work log:", (event.target as IDBRequest).error);
      reject("Error adding data to IndexedDB");
    };
  });
};

// Get all pending work logs from the object store
export const getPendingWorkLogs = async (): Promise<PendingWorkLogData[]> => {
  const currentDb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = currentDb.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest<PendingWorkLogData[]>).result);
    };

    request.onerror = (event) => {
      console.error("Error getting pending work logs:", (event.target as IDBRequest).error);
      reject("Error retrieving data from IndexedDB");
    };
  });
};

// Delete a pending work log by its temporary ID
export const deletePendingWorkLog = async (tempId: string): Promise<void> => {
  const currentDb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = currentDb.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(tempId);

    request.onsuccess = () => {
      console.log(`Pending work log deleted with tempId: ${tempId}`);
      resolve();
    };

    request.onerror = (event) => {
      console.error("Error deleting pending work log:", (event.target as IDBRequest).error);
      reject("Error deleting data from IndexedDB");
    };
  });
}; 