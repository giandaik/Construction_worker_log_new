'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewTenantPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '', plan: 'free', initialAdmin: { name: '', email: '', password: '', confirmPassword: '' } });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleNameChange(name: string) {
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setForm((prev) => ({ ...prev, name, slug }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create tenant'); setSaving(false); return; }
      router.push(`/platform/tenants/${data.tenantId}`);
    } catch {
      setError('Network error. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>New Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="name">Organisation Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
            </div>
            <div className="border-t pt-4">
              <h2 className="mb-3 font-semibold">Initial Administrator</h2>
              <div className="space-y-4">
                <div className="space-y-1"><Label htmlFor="admin-name">Name</Label><Input id="admin-name" value={form.initialAdmin.name} onChange={(e) => setForm((p) => ({ ...p, initialAdmin: { ...p.initialAdmin, name: e.target.value } }))} required /></div>
                <div className="space-y-1"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" type="email" value={form.initialAdmin.email} autoComplete="off" onChange={(e) => setForm((p) => ({ ...p, initialAdmin: { ...p.initialAdmin, email: e.target.value } }))} required /></div>
                <div className="space-y-1"><Label htmlFor="admin-password">Password</Label><Input id="admin-password" type="password" minLength={8} autoComplete="new-password" value={form.initialAdmin.password} onChange={(e) => setForm((p) => ({ ...p, initialAdmin: { ...p.initialAdmin, password: e.target.value } }))} required /></div>
                <div className="space-y-1"><Label htmlFor="admin-confirm-password">Confirm Password</Label><Input id="admin-confirm-password" type="password" minLength={8} autoComplete="new-password" value={form.initialAdmin.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, initialAdmin: { ...p.initialAdmin, confirmPassword: e.target.value } }))} required /></div>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan">Plan</Label>
              <Input
                id="plan"
                value={form.plan}
                onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Creating…' : 'Create Tenant'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
