'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlatformUser { _id: string; name: string; email: string; platformRole: string; }

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/platform/users').then((response) => response.json()).then((data) => {
      setUsers(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Platform Users</h1><p className="text-sm text-muted-foreground">SuperAdmins only</p></div>
        <Button asChild><Link href="/platform/users/new"><Plus className="mr-2 h-4 w-4" /> New SuperAdmin</Link></Button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">No platform SuperAdmins found.</p></div>
      ) : <div className="overflow-hidden rounded-lg border"><div className="grid grid-cols-3 gap-4 border-b bg-muted/50 p-4 text-sm font-medium"><span>Name</span><span>Email</span><span>Role</span></div>{users.map((user) => <div key={user._id} className="grid grid-cols-3 gap-4 border-b p-4 text-sm last:border-0"><span>{user.name}</span><span>{user.email}</span><span>{user.platformRole}</span></div>)}</div>}
    </div>
  );
}