'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/apiClient';
import { setMobileToken } from '@/lib/mobile-auth';

export function ImpersonationBanner() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleEnd() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/platform/impersonation', { method: 'DELETE' });
      const data = await res.json();
      // The restored super-admin token comes back in the body for mobile,
      // which never received the Set-Cookie. No-op on web.
      if (data.token) {
        await setMobileToken(data.token);
      }
      router.push(data.redirect ?? '/platform');
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        You are currently impersonating a tenant user
      </span>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-800 bg-amber-400 text-amber-950 hover:bg-amber-300"
        disabled={loading}
        onClick={handleEnd}
      >
        {loading ? 'Ending…' : 'End Impersonation'}
      </Button>
    </div>
  );
}
