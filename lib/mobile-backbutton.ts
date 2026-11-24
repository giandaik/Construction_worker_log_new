/**
 * Android hardware back button.
 *
 * Capacitor's default is to close the app the moment back is pressed. In a
 * multi-screen app that reads as a crash: the user is three levels deep in a
 * work log and the whole app disappears. Registering a listener takes the event
 * over — if the WebView has history behind it, go back through it, and only
 * close the app when there is nothing left to go back to.
 *
 * No-op on web and on iOS, which has no hardware back button, so it is safe to
 * call unconditionally.
 */

import { isMobileApp } from './mobile-auth';

export async function initBackButton(): Promise<void> {
  if (!(await isMobileApp())) return;

  try {
    const { App } = await import('@capacitor/app');

    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }

      // Root screen (dashboard): there is nowhere to go back to, and staying
      // put would make the button feel broken. Closing is the platform
      // convention here.
      void App.exitApp();
    });
  } catch (error) {
    // The default behaviour (close the app) is still better than a boot that
    // throws, so log and carry on.
    console.error('Failed to register the back button handler:', error);
  }
}
