/**
 * Status bar styling for the Capacitor shell.
 *
 * No-op on web, so it is safe to call unconditionally.
 */

import { isMobileApp } from './mobile-auth';

/**
 * Construction yellow, matching the splash `backgroundColor` in
 * `capacitor.config.ts` — keep the two in step.
 */
export const STATUS_BAR_COLOR = '#FBBF24';

export async function initStatusBar(): Promise<void> {
  if (!(await isMobileApp())) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');

    // `Style.Light` means "light background", i.e. dark icons and clock — which
    // is what stays legible against the yellow.
    await StatusBar.setStyle({ style: Style.Light });

    // Android only: iOS has no settable status bar background (the WebView shows
    // through), so a rejection here is expected there and not worth reporting.
    await StatusBar.setBackgroundColor({ color: STATUS_BAR_COLOR }).catch(() => {});
  } catch (error) {
    console.error('Failed to style the status bar:', error);
  }
}
