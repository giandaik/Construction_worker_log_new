import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, ShieldCheck } from 'lucide-react';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';
import { RepositoryFactory } from '@/lib/repositories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PlatformPage() {
  const user = await getAuthUser();
  if (!user || !isSuperAdmin(user)) redirect('/');

  const [tenants, users] = await Promise.all([
    RepositoryFactory.withTenantRepository((r) => r.findAll({} as any, { sort: { name: 1 } })),
    RepositoryFactory.withUserRepository((r) => r.findPlatformSuperAdmins()),
  ]);

  const activeTenants = tenants.filter((t) => t.status === 'active').length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Administration</h1>
          <p className="text-sm text-muted-foreground">Manage tenants, users, and platform settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/platform/users">Platform Users</Link></Button>
          <Button asChild><Link href="/platform/tenants/new">New Tenant</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.length}</div>
            <p className="text-xs text-muted-foreground">{activeTenants} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platform Role</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Super Admin</div>
            <p className="text-xs text-muted-foreground">{user.name}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tenants</h2>
          <Button variant="outline" asChild>
            <Link href="/platform/tenants">View all</Link>
          </Button>
        </div>
        <div className="space-y-2">
          {tenants.slice(0, 5).map((t) => (
            <div key={String(t._id)} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.slug} · {t.status}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/platform/tenants/${t._id}`}>Manage</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
