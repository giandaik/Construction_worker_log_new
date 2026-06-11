'use client'; // This component interacts with browser APIs (IndexedDB) and state

import React, { useState, useEffect, useCallback } from 'react';
import { getPendingWorkLogs, PendingWorkLogData } from '@/lib/indexedDBHelper';
import { syncPendingWorkLogs } from '@/lib/syncService';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import type { Project, WorkLog } from '@/types/shared';

interface PendingSubmissionsProps {
  initialData: {
    projects: Project[];
    workLogs: WorkLog[];
  };
}

export const PendingSubmissions = React.memo<PendingSubmissionsProps>(({ initialData }) => {
  const [pendingLogs, setPendingLogs] = useState<PendingWorkLogData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const { handleError } = useErrorHandler();

  const getProjectName = useCallback((projectId: string) => {
    const project = initialData.projects.find(p => p._id === projectId);
    return project ? project.name : 'Unknown Project';
  }, [initialData.projects]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const logs = await getPendingWorkLogs();
      setPendingLogs(logs);
    } catch (err) {
      handleError(err, 'PendingSubmissions.fetchLogs', 'Could not load pending submissions.');
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    // Delay the initial fetch to allow main content to load first
    const timer = setTimeout(() => {
      fetchLogs();
    }, 1000);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const handleSync = useCallback(async () => {
    if (isSyncing) {
      console.log('Sync already in progress.');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Syncing pending submissions...');

    try {
      const { successful, failed } = await syncPendingWorkLogs();
      if (successful > 0 || failed > 0) {
        setSyncStatus(`Sync finished: ${successful} successful, ${failed} failed.`);
      }
      // Clear message after delay
      setTimeout(() => setSyncStatus(null), 5000);
      // Refresh the list after sync
      await fetchLogs();
    } catch (error) {
      handleError(error, 'PendingSubmissions.handleSync', 'Error during synchronization process.');
      setSyncStatus('Error during synchronization process.');
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, handleError, fetchLogs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Submissions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
          </div>
        ) : pendingLogs.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            No pending submissions
          </div>
        ) : (
          <div className="space-y-4">
            {pendingLogs.map((log) => (
              <div key={log.tempId} className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                <div className="font-medium">{log.workDescription}</div>
                {log.project && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Project: {getProjectName(log.project)}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-1">
                  {new Date(log.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={fetchLogs}
          disabled={isLoading}
        >
          Refresh
        </Button>
        <Button
          onClick={handleSync}
          disabled={isSyncing || pendingLogs.length === 0}
        >
          {isSyncing ? "Syncing..." : "Sync All"}
        </Button>
      </CardFooter>
      {syncStatus && (
        <div className="px-4 pb-4 text-sm text-muted-foreground">
          {syncStatus}
        </div>
      )}
    </Card>
  );
}); 