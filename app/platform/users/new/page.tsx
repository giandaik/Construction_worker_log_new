'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewPlatformUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const response = await fetch('/api/platform/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? 'Failed to create SuperAdmin'); setSaving(false); return; }
      router.push('/platform/users');
    } catch { setError('Network error. Please try again.'); setSaving(false); }
  }

  return <div className="container mx-auto max-w-lg px-4 py-8">
    <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 -ml-2"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
    <Card><CardHeader><CardTitle>New SuperAdmin</CardTitle></CardHeader><CardContent><form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {(['name', 'email', 'password', 'confirmPassword'] as const).map((field) => <div key={field} className="space-y-1"><Label htmlFor={field}>{field === 'confirmPassword' ? 'Confirm Password' : field[0].toUpperCase() + field.slice(1)}</Label><Input id={field} type={field.includes('password') || field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} required /></div>)}
      <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Creating...' : 'Create SuperAdmin'}</Button>
    </form></CardContent></Card>
  </div>;
}