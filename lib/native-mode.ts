/**
 * Is this bundle the Capacitor build?
 *
 * `NEXT_PUBLIC_API_BASE_URL` is inlined at build time by `scripts/build-mobile.mjs`
 * and is empty on the web build, so server components and the first client
 * render always agree — no hydration mismatch, no flash of web chrome.
 *
 * Web is not a fallback to be patched later: it is a different presentation of
 * the same screens, so every restyle passes two class strings through `nv()`.
 */
export function isNativeBundle(): boolean {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "").length > 0
}

/**
 * Pick the native class string in the mobile bundle, the web one everywhere else.
 *
 *   className={nv("container px-4 py-8", "px-4 pt-1 pb-6")}
 */
export function nv(web: string, nativeCls: string): string {
  return isNativeBundle() ? nativeCls : web
}
