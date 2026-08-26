import { useState, useEffect } from 'react';
import { isMobileApp } from '@/lib/mobile-auth';

/**
 * Tracks online/offline status.
 *
 * On native, `@capacitor/network` reports the real link state — the WebView's
 * `navigator.onLine` only tells you the WebView has *an* interface, not that it
 * can reach anything. On web, `navigator.onLine` plus the window online/offline
 * events, exactly as before.
 *
 * The plugin sits behind a dynamic import guarded by `isMobileApp()` (the same
 * shape as `lib/mobile-auth.ts`), so the web bundle splits it into a chunk it
 * never fetches.
 *
 * @returns isOnline - boolean indicating current connection status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Subscribing is async, so a listener can fire — or an await can resolve —
    // after unmount. Routing every update through here drops those.
    const report = (connected: boolean) => {
      if (!cancelled) setIsOnline(connected);
    };

    function subscribeToBrowserEvents(): () => void {
      const updateOnlineStatus = () => report(navigator.onLine);

      updateOnlineStatus();
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);

      return () => {
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
      };
    }

    /** Null when the plugin is unavailable, so the caller can fall back to web. */
    async function subscribeToNativeNetwork(): Promise<(() => void) | null> {
      try {
        const { Network } = await import('@capacitor/network');

        // Listener first, then the initial read: a change that lands in between
        // is delivered rather than lost.
        const handle = await Network.addListener('networkStatusChange', (status) =>
          report(status.connected),
        );
        report((await Network.getStatus()).connected);

        return () => {
          handle.remove();
        };
      } catch (error) {
        console.error('Capacitor Network unavailable, using navigator.onLine:', error);
        return null;
      }
    }

    (async () => {
      const native = (await isMobileApp()) ? await subscribeToNativeNetwork() : null;
      const teardown = native ?? subscribeToBrowserEvents();

      if (cancelled) teardown();
      else unsubscribe = teardown;
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return isOnline;
}
