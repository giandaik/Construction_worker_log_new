'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { UserCog } from 'lucide-react';
import { setMobileToken } from '@/lib/mobile-auth';

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
}

interface Member {
  userId: string;
  name: string;
  email: string;
  tenantRole: string;
  isActive: boolean;
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

  // Impersonation: the API has existed all along, but with nothing on this
  // page a support engineer had no way to start a session from the UI.
  const [members, setMembers] = useState<Member[]>([]);
  const [impersonating, setImpersonating] = useState<Member | null>(null);
  const [impersonationReason, setImpersonationReason] = useState('');
  const [impersonationError, setImpersonationError] = useState<string | null>(null);
  const [startingImpersonation, setStartingImpersonation] = useState(false);

  const loadMembers = useCallback(async () => {
    const m = await fetch(`/api/platform/tenants/${id}/members`)
      .then((r) => r.json())
      .catch(() => ({ count: 0, members: [] }));
    setMemberCount(m.count ?? 0);
    setMembers(m.members ?? []);
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/platform/tenants/${id}`).then((r) => r.json()),
      fetch(`/api/platform/tenants/${id}/members`).then((r) => r.json()).catch(() => ({ count: 0, members: [] })),
    ]).then(([t, m]) => {
      setTenant(t);
      setMemberCount(m.count ?? 0);
      setMembers(m.members ?? []);
      setLoading(false);
    });
  }, [id]);

  async function handleImpersonate(e: React.FormEvent) {
    e.preventDefault();
    if (!impersonating) return;

    setImpersonationError(null);
    setStartingImpersonation(true);

    try {
      const res = await fetch(`/api/platform/tenants/${id}/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: impersonating.userId, reason: impersonationReason.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setImpersonationError(data.error ?? 'Could not start impersonation');
        setStartingImpersonation(false);
        return;
      }

      // The route sets the session cookie to the impersonation token, so the
      // banner in the navbar is what tells the operator where they are.
      if (data.token) {
        await setMobileToken(data.token);
      }
      router.push(data.redirect ?? '/app');
      router.refresh();
    } catch {
      setImpersonationError('Network error. Please try again.');
      setStartingImpersonation(false);
    }
  }

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

      // Refresh the member list (and its count) after the new admin exists
      await loadMembers();
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
        <CardContent className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{member.tenantRole}</Badge>
                  {!member.isActive && <Badge variant="secondary">inactive</Badge>}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!member.isActive || tenant.status !== 'active'}
                    onClick={() => {
                      setImpersonating(member);
                      setImpersonationReason('');
                      setImpersonationError(null);
                    }}
                  >
                    <UserCog className="mr-2 h-4 w-4" /> Impersonate
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(impersonating)}
        onOpenChange={(open) => {
          if (!open) setImpersonating(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Impersonate {impersonating?.name}</DialogTitle>
            <DialogDescription>
              You will see {tenant.name} through this user&apos;s eyes. The session lasts four
              hours and is recorded in the audit log with the reason below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImpersonate} className="space-y-4">
            {impersonationError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {impersonationError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="impersonation-reason">Reason</Label>
              <Input
                id="impersonation-reason"
                value={impersonationReason}
                onChange={(e) => setImpersonationReason(e.target.value)}
                placeholder="e.g. customer reports a missing work log"
                maxLength={500}
                disabled={startingImpersonation}
              />
            </div>
            <Button type="submit" className="w-full" disabled={startingImpersonation}>
              {startingImpersonation ? 'Starting…' : 'Start impersonation'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
