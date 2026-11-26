'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/apiClient';

interface SignupRequest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  message?: string;
  createdAt: string;
  isProcessing: boolean;
}

interface Tenant {
  _id: string;
  name: string;
  status: string;
}

type TenantRole = 'ADMIN' | 'MANAGER' | 'WORKER';

export default function SignupRequestsPage() {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [tenantIds, setTenantIds] = useState<Record<string, string>>({});
  const [tenantRoles, setTenantRoles] = useState<Record<string, TenantRole>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [requestsResponse, tenantsResponse] = await Promise.all([
        apiFetch('/api/platform/signup-requests'),
        apiFetch('/api/platform/tenants'),
      ]);
      if (!requestsResponse.ok) throw new Error(`Failed to load requests (${requestsResponse.status})`);
      if (!tenantsResponse.ok) throw new Error(`Failed to load organisations (${tenantsResponse.status})`);

      const requestData = await requestsResponse.json();
      const tenantData = await tenantsResponse.json();
      setRequests(Array.isArray(requestData) ? requestData : []);
      setTenants(Array.isArray(tenantData) ? tenantData : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load signup requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function decide(requestItem: SignupRequest, action: 'approve' | 'reject') {
    setActionError(null);
    if (action === 'approve' && !tenantIds[requestItem.id]) {
      setActionError('Choose an active organisation before approving this request.');
      return;
    }

    setBusyRequestId(requestItem.id);
    try {
      const body = action === 'approve'
        ? {
            action,
            tenantId: tenantIds[requestItem.id],
            tenantRole: tenantRoles[requestItem.id] ?? 'WORKER',
          }
        : { action };
      const response = await apiFetch(`/api/platform/signup-requests/${requestItem.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not process this request');

      if (action === 'reject' && data.notificationSent === false) {
        setActionError('The request was rejected, but the applicant could not be notified by email.');
      }
      setRequests((current) => current.filter((item) => item.id !== requestItem.id));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not process this request');
    } finally {
      setBusyRequestId(null);
    }
  }

  const activeTenants = tenants.filter((tenant) => tenant.status === 'active');

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Signup requests</h1>
          <p className="text-sm text-muted-foreground">
            Review each request and choose an organisation and role before sending an invitation.
          </p>
        </div>
        <Button variant="outline" asChild><Link href="/platform">Platform home</Link></Button>
      </div>

      {actionError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}
      {loadError && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <p>{loadError}</p>
          <Button variant="link" onClick={() => void loadData()} className="px-0">Try again</Button>
        </div>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">No pending signup requests</p>
          <p className="mt-1 text-sm text-muted-foreground">New requests will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((item) => (
            <section key={item.id} className="space-y-4 rounded-lg border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{item.firstName} {item.lastName}</h2>
                  <p className="text-sm">{item.email}</p>
                  <p className="text-sm text-muted-foreground">{item.organizationName}</p>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString()}
                </time>
              </div>
              {item.message && (
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{item.message}</p>
              )}
              {item.isProcessing && (
                <p className="text-sm text-muted-foreground">Another administrator is reviewing this request.</p>
              )}
              {activeTenants.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Create an active organisation before approving.{' '}
                    <Link href="/platform/tenants/new" className="underline">Create organisation</Link>
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void decide(item, 'reject')}
                    disabled={item.isProcessing || busyRequestId === item.id}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto_auto] sm:items-end">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Organisation</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={tenantIds[item.id] ?? ''}
                      onChange={(event) => setTenantIds((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))}
                      disabled={item.isProcessing || busyRequestId === item.id}
                    >
                      <option value="">Select an organisation</option>
                      {activeTenants.map((tenant) => (
                        <option key={tenant._id} value={tenant._id}>{tenant.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Role</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={tenantRoles[item.id] ?? 'WORKER'}
                      onChange={(event) => setTenantRoles((current) => ({
                        ...current,
                        [item.id]: event.target.value as TenantRole,
                      }))}
                      disabled={item.isProcessing || busyRequestId === item.id}
                    >
                      <option value="WORKER">Worker</option>
                      <option value="MANAGER">Supervisor</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                  </label>
                  <Button
                    onClick={() => void decide(item, 'approve')}
                    disabled={item.isProcessing || busyRequestId === item.id || activeTenants.length === 0}
                  >
                    {busyRequestId === item.id ? 'Working...' : 'Approve & invite'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void decide(item, 'reject')}
                    disabled={item.isProcessing || busyRequestId === item.id}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
