'use client';

import React, { useEffect, useState } from 'react';
import { initDB } from "@/lib/indexedDBHelper";
import { syncPendingWorkLogs } from "@/lib/syncService";
import { SYNC_DELAY_MS, TOAST_DURATION } from '@/lib/constants/constants';

export const SyncManager: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSync = async () => {
    if (isSyncing) {
      console.log("Sync already in progress.");
      return;
    }
    setIsSyncing(true);

    try {
      const { successful, failed } = await syncPendingWorkLogs();
      if (successful > 0 || failed > 0) {
        setSyncMessage(`Sync finished: ${successful} successful, ${failed} failed.`);
        setTimeout(() => setSyncMessage(null), TOAST_DURATION.MEDIUM);
      }
    } catch (error) {
      console.error("Sync process error:", error);
      setSyncMessage("Error during synchronization process.");
      setTimeout(() => setSyncMessage(null), TOAST_DURATION.MEDIUM);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Check if running in browser environment
    if (typeof window === 'undefined') return;

    // Delay initialization until after main content loads
    const timer = setTimeout(() => {
      // Initialize DB and attempt initial sync if online
      initDB()
        .then(() => {
          console.log("Database initialized by SyncManager.");
          if (navigator.onLine) {
            handleSync();
          }
        })
        .catch(err => console.error("SyncManager failed to initialize DB:", err));
    }, SYNC_DELAY_MS);

    const handleOnline = () => {
      console.log("Application came online.");
      handleSync();
    };

    const handleOffline = () => {
      console.log("Application went offline.");
    };

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup listeners on component unmount
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(timer);
    };
  }, []); // Empty dependency array - only run once on mount

  // Render the sync status message
  return syncMessage ? (
    <div className="fixed bottom-4 left-4 bg-foreground/90 text-background px-4 py-2 rounded-md z-50">
      {syncMessage}
    </div>
  ) : null;
}; 