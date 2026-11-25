import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.constructionlog.app',
  appName: 'Construction Worker Log',
  webDir: 'out',
  plugins: {
    // The webview runs on the capacitor:// scheme; cookies and CORS from that
    // origin are unreliable inside WKWebView, so route every API call through
    // the native HTTP client (URLSession) instead.
    CapacitorHttp: {
      enabled: true,
    },
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
