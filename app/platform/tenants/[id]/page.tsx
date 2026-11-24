'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddAdminDialog, setShowAddAdminDialog] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState({ email: '', name: '', password: '', confirmPassword: '' });
  const [addAdminError, setAddAdminError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/platform/tenants/${id}`).then((r) => r.json()),
      fetch(`/api/platform/tenants/${id}/members`).then((r) => r.json()).catch(() => ({ count: 0 })),
    ]).then(([t, m]) => {
      setTenant(t);
      setMemberCount(m.count ?? 0);
      setLoading(false);
    });
  }, [id]);

  async function handleStatusChange(status: string) {
    await fetch(`/api/platform/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setTenant((prev) => prev ? { ...prev, status } : prev);
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAddAdminError(null);

    if (addAdminForm.password !== addAdminForm.confirmPassword) {
      setAddAdminError('Passwords do not match');
      return;
    }

    if (addAdminForm.password.length < 8) {
      setAddAdminError('Password must be at least 8 characters');
      return;
    }

    setAddingAdmin(true);

    try {
      const res = await fetch(`/api/platform/tenants/${id}/add-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addAdminForm.email,
          name: addAdminForm.name,
          password: addAdminForm.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAddAdminError(data.error ?? 'Failed to create admin user');
        setAddingAdmin(false);
        return;
      }

      // Reset form and close dialog
      setAddAdminForm({ email: '', name: '', password: '', confirmPassword: '' });
      setShowAddAdminDialog(false);
      setAddingAdmin(false);

      // Refresh member count
      const countRes = await fetch(`/api/platform/tenants/${id}/members`);
      const countData = await countRes.json();
      setMemberCount(countData.count ?? 0);
    } catch (error) {
      setAddAdminError('Network error. Please try again.');
      setAddingAdmin(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!tenant) return <div className="p-8 text-sm text-destructive">Tenant not found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 -ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{tenant.slug} · {tenant.plan}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={tenant.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Members: {memberCount}</CardTitle>
          <Dialog open={showAddAdminDialog} onOpenChange={setShowAddAdminDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="mr-2 h-4 w-4" /> Add Admin User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Admin User</DialogTitle>
                <DialogDescription>
                  Create a new admin user for {tenant.name}. They will have ADMIN access to this organisation.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddAdmin} className="space-y-4">
                {addAdminError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{addAdminError}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Full Name</Label>
                  <Input
                    id="admin-name"
                    type="text"
                    value={addAdminForm.name}
                    onChange={(e) => setAddAdminForm((p) => ({ ...p, name: e.target.value }))}
                    required
                    disabled={addingAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={addAdminForm.email}
                    onChange={(e) => setAddAdminForm((p) => ({ ...p, email: e.target.value }))}
                    required
                    disabled={addingAdmin}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={addAdminForm.password}
                    onChange={(e) => setAddAdminForm((p) => ({ ...p, password: e.target.value }))}
                    required
                    disabled={addingAdmin}
                    autoComplete="new-password" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                  <Input
                    id="admin-confirm-password"
                    type="password"
                    value={addAdminForm.confirmPassword}
                    onChange={(e) => setAddAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                    required
                    disabled={addingAdmin}
                    autoComplete="new-password" 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={addingAdmin}>
                  {addingAdmin ? 'Creating…' : 'Create Admin User'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>
    </div>
  );
}
