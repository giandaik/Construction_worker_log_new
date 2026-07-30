/**
 * Next.js config for Capacitor mobile builds (static export).
 *
 * Deliberately self-contained rather than importing `next.config.mjs`:
 * `scripts/build-mobile.mjs` swaps this file into place *as* `next.config.mjs`
 * for the duration of the build (Next has no `--config` flag), so importing the
 * base config from here would be a self-import.
 *
 * Differences from the web config:
 *  - `output: 'export'` — emits a static `out/` bundle for the native WebView.
 *  - `images.unoptimized` — the /_next/image optimizer needs a server.
 *  - no `redirects()` — redirects are issued by a server that does not exist here.
 *
 * `distDir` is deliberately left at its default: under `output: 'export'` Next
 * treats `distDir` as the *export* directory, so setting it would move the
 * bundle away from the `out/` that `capacitor.config.ts` points `webDir` at.
 * The build script stashes `.next` instead, so the web build cache survives.
 *
 * @type {import('next').NextConfig}
 */
const mobileConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'export',
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default mobileConfig;
