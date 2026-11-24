'use client';

import { useEffect } from 'react';
import { isMobileApp } from '@/lib/mobile-auth';
import { initBackButton } from '@/lib/mobile-backbutton';
import { initSplashScreen } from '@/lib/mobile-splash';
import { initStatusBar } from '@/lib/mobile-statusbar';

/**
 * Boots the native-shell-only plugins once React has mounted. Renders nothing,
 * and is inert on web — every plugin it touches is behind a dynamic import
 * guarded by `isMobileApp()`.
 */
export function MobileInit() {
  useEffect(() => {
    (async () => {
      if (!(await isMobileApp())) return;

      // Sequential, not parallel: the splash is what hides the unstyled status
      // bar, so dropping it first would flash the default bar before the theme
      // colour lands.
      await initStatusBar();
      await initSplashScreen();

      // Independent of the splash: a missed back-button registration only costs
      // the default (close-the-app) behaviour, never the boot.
      await initBackButton();
    })();
  }, []);

  return null;
}
