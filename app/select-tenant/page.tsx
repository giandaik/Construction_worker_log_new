'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TenantOption {
  tenantId: string;
  tenantName: string;
  tenantRole: string;
}

export default function SelectTenantPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Tenants are stored in sessionStorage by the login page after a
    // tenant_selection_required response.
    try {
      const stored = sessionStorage.getItem('pending_tenants');
      if (stored) setTenants(JSON.parse(stored));
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  async function select(tenantId: string) {
    setSelecting(tenantId);
    setError(null);
    try {
      const res = await fetch('/api/auth/select-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to select organisation');
        setSelecting(null);
        return;
      }
      sessionStorage.removeItem('pending_tenants');
      router.push('/');
    } catch {
      setError('Network error. Please try again.');
      setSelecting(null);
    }
  }

  if (loading) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Select Organisation</CardTitle>
          <CardDescription>
            Your account belongs to multiple organisations. Choose one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          {tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organisations found. Contact your administrator.</p>
          ) : (
            tenants.map((t) => (
              <button
                key={t.tenantId}
                onClick={() => select(t.tenantId)}
                disabled={!!selecting}
                className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t.tenantName}</p>
                  <p className="text-xs capitalize text-muted-foreground">{t.tenantRole}</p>
                </div>
                {selecting === t.tenantId && (
                  <span className="ml-auto text-xs text-muted-foreground">Loading…</span>
                )}
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
