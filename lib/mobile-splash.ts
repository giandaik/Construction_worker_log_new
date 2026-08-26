/**
 * Splash screen control for the Capacitor shell.
 *
 * The native shell shows the splash on launch; `capacitor.config.ts` caps it at
 * `launchShowDuration` as a backstop. Hiding it from JS is what makes the
 * hand-off tight: the splash stays up until React has actually mounted, rather
 * than uncovering a blank WebView for the rest of the timeout.
 *
 * No-op on web, so it is safe to call unconditionally.
 */

import { isMobileApp } from './mobile-auth';

export async function initSplashScreen(): Promise<void> {
  if (!(await isMobileApp())) return;

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (error) {
    // A splash that fails to hide is cosmetic — `launchShowDuration` still
    // dismisses it — so never let it break app boot.
    console.error('Failed to hide the splash screen:', error);
  }
}
