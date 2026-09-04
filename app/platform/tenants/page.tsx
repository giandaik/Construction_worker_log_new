'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  createdAt: string;
  memberCount?: number;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/platform/tenants')
      .then((r) => r.json())
      .then((data) => { setTenants(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusVariant = (s: string) =>
    s === 'active' ? 'default' : s === 'disabled' ? 'secondary' : 'destructive';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <Button asChild>
          <Link href="/platform/tenants/new">
            <Plus className="mr-2 h-4 w-4" /> New Tenant
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tenants.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No tenants yet. Create the first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tenants.map((t) => (
            <div key={t._id} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.slug} · {t.plan} · Members: {t.memberCount ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={statusVariant(t.status) as any}>{t.status}</Badge>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/platform/tenants/${t._id}`}>Manage</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
