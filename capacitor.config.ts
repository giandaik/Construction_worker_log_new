import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.constructionlog.app',
  appName: 'Construction Worker Log',
  webDir: 'out',
  plugins: {
    SplashScreen: {
      // Backstop only — `MobileInit` hides the splash as soon as React mounts,
      // which is normally well under this. It caps how long a stalled boot can
      // sit behind the splash.
      launchShowDuration: 2000,
      // Keep in step with STATUS_BAR_COLOR in lib/mobile-statusbar.ts.
      backgroundColor: '#FBBF24',
      showSpinner: false,
    },
  },
};

export default config;
