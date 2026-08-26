/**
 * JWT storage for the Capacitor WebView.
 *
 * The WebView document origin (`capacitor://localhost` on iOS,
 * `http://localhost` on Android) is not the API origin, so the session cookie
 * set by `POST /api/login` never reaches it. Mobile keeps the JWT on the device
 * instead and sends it as `Authorization: Bearer` on every call — see
 * `lib/apiClient.ts` for the attach side and `utils/auth.ts` for the read side.
 *
 * `@capacitor/preferences` is loaded by dynamic import so that neither the web
 * bundle nor a server render ever pulls in the native plugin. Every export here
 * is a no-op on web, which is what makes it safe to call unconditionally.
 */

const TOKEN_KEY = 'cw_jwt_token';

/**
 * True only inside a real native Capacitor shell. Safe on web and during SSR:
 * a failed import or a missing global resolves to false rather than throwing.
 */
export async function isMobileApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Resolves the Preferences plugin, or null when it is unavailable (web, SSR).
 * Callers treat null as "no token storage on this platform".
 */
async function getPreferences() {
  if (!(await isMobileApp())) return null;

  try {
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences;
  } catch {
    return null;
  }
}

export async function getMobileToken(): Promise<string | null> {
  const preferences = await getPreferences();
  if (!preferences) return null;

  try {
    const { value } = await preferences.get({ key: TOKEN_KEY });
    return value;
  } catch (error) {
    console.error('Failed to read stored auth token:', error);
    return null;
  }
}

export async function setMobileToken(token: string): Promise<void> {
  const preferences = await getPreferences();
  if (!preferences) return;

  try {
    await preferences.set({ key: TOKEN_KEY, value: token });
  } catch (error) {
    // A failed write is not fatal for the current session — the token is
    // already in memory for this launch — but it will not survive a restart.
    console.error('Failed to persist auth token:', error);
  }
}

export async function clearMobileToken(): Promise<void> {
  const preferences = await getPreferences();
  if (!preferences) return;

  try {
    await preferences.remove({ key: TOKEN_KEY });
  } catch (error) {
    console.error('Failed to clear stored auth token:', error);
  }
}
