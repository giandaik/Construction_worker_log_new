/**
 * Synchronous access to the Capacitor bridge that the native shell injects.
 *
 * The plugins below used to be reached with `await import('@capacitor/…')`.
 * Inside the WKWebView that dynamic chunk load never settles: the promise
 * neither resolves nor rejects, so `isMobileApp()` never answers and every
 * `apiFetch` call that awaited it hung before it ever touched the network —
 * the symptom was a form stuck on "Signing in…" and screens stuck on
 * "Loading sites…" with no request in the API log.
 *
 * The shell injects the same objects as `window.Capacitor` before the bundle
 * runs, so read them synchronously and only fall back to a dynamic import when
 * the global is absent (web, SSR) — where the import resolves normally.
 */

type NativeBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, any>;
};

function bridge(): NativeBridge | null {
  if (typeof globalThis === 'undefined') return null;
  const candidate = (globalThis as any).Capacitor ?? (globalThis as any).window?.Capacitor;
  return candidate && typeof candidate === 'object' ? (candidate as NativeBridge) : null;
}

/** The native shell's bridge, or null on web and during SSR. */
export function nativeBridge(): NativeBridge | null {
  return bridge();
}

/** True only inside a real native shell. Synchronous; safe on web and SSR. */
export function isNativeShell(): boolean {
  try {
    return !!bridge()?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * One injected plugin (e.g. `Preferences`, `CapacitorHttp`), or null when the
 * shell has not registered it — web, SSR, or a plugin missing from the native
 * project. Never touches the network or the module loader.
 */
export function nativePlugin<T = any>(name: string): T | null {
  const plugins = bridge()?.Plugins;
  const plugin = plugins ? plugins[name] : null;
  return plugin ?? null;
}
