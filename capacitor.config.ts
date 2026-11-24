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
    Keyboard: {
      // The work-log form is long and its fields sit near the bottom of the
      // viewport. Without resizing, iOS slides the keyboard over the focused
      // input and the user types blind. `native` shrinks the WebView instead so
      // the browser scrolls the field into view; Android already does this.
      resize: 'native',
    },
  },
};

export default config;
