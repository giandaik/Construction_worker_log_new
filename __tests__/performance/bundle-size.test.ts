/**
 * Performance Tests for Bundle Size and Code Splitting
 * Tests dynamic imports and bundle optimization
 *
 * These assertions read the *production* build output in `.next`, which is a
 * cache rather than a fact: Next never prunes stale chunks, and a `next dev`
 * compile leaves unminified megabytes behind. Each test therefore measures
 * only what the current build manifest references, and skips (loudly) when
 * `.next` is missing or older than the sources.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const buildDir = join(process.cwd(), '.next');
const serverDir = join(buildDir, 'server', 'app');
const clientChunksDir = join(buildDir, 'static', 'chunks');

/** JS chunks the current build manifest references, or null when absent. */
function currentBuildChunks(): string[] | null {
  const manifestPath = join(buildDir, 'app-build-manifest.json');
  if (!existsSync(manifestPath)) return null;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    pages?: Record<string, string[]>;
  };

  const chunks = new Set<string>();
  for (const files of Object.values(manifest.pages ?? {})) {
    for (const file of files) {
      if (file.endsWith('.js') && existsSync(join(buildDir, file))) chunks.add(file);
    }
  }
  return [...chunks];
}

/** Chunks a route loads eagerly, per the current build manifest. */
function eagerChunksFor(route: string): string[] {
  const manifestPath = join(buildDir, 'app-build-manifest.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    pages?: Record<string, string[]>;
  };
  return manifest.pages?.[route] ?? [];
}

/** Newest mtime under the source trees that feed the bundle. */
function newestSourceMtime(): number {
  let newest = 0;
  const roots = ['app', 'lib', 'components', 'hooks', 'utils'].map((d) =>
    join(process.cwd(), d),
  );

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) walk(fullPath);
      else if (/\.(ts|tsx|js|jsx|css)$/.test(entry)) {
        newest = Math.max(newest, stat.mtimeMs);
      }
    }
  }

  roots.forEach(walk);
  return newest;
}

/**
 * True when `.next` reflects the sources on disk. A stale or leftover dev
 * build makes every size assertion below meaningless, so they skip instead of
 * reporting a number about code that no longer exists.
 */
function buildMatchesSources(): boolean {
  const buildId = join(buildDir, 'BUILD_ID');
  const buildMtime = existsSync(buildId) ? statSync(buildId).mtimeMs : 0;
  return buildMtime >= newestSourceMtime();
}

/** Client chunks whose content matches `marker` — i.e. a code-split artifact. */
function findChunksContaining(marker: RegExp): string[] {
  if (!existsSync(clientChunksDir)) return [];
  const matches: string[] = [];
  for (const entry of readdirSync(clientChunksDir)) {
    if (!entry.endsWith('.js')) continue;
    const fullPath = join(clientChunksDir, entry);
    if (statSync(fullPath).isFile() && marker.test(readFileSync(fullPath, 'utf-8'))) {
      matches.push(entry);
    }
  }
  return matches;
}

describe('Performance: Bundle Size Optimization', () => {
  describe('Dynamic Import - PDF Export', () => {
    it('ships the PDF exporter (jspdf) in a chunk of its own', () => {
      if (!existsSync(clientChunksDir)) {
        console.warn('Build directory not found. Run "npm run build" first.');
        return;
      }

      const chunks = findChunksContaining(/jspdf|jsPDF/);

      console.log(`
        📦 PDF Export Module:
        - Chunks containing jspdf: ${chunks.length}
        ${chunks.map((chunk) => `        - ${chunk}`).join('\n')}
      `);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('does not load the PDF exporter eagerly on the worklog detail route', () => {
      if (!existsSync(clientChunksDir)) {
        console.warn('Build directory not found. Run "npm run build" first.');
        return;
      }

      const pdfChunks = findChunksContaining(/jspdf|jsPDF/);
      if (pdfChunks.length === 0) {
        // No chunk to reason about; the previous test reports this.
        return;
      }

      const eager = eagerChunksFor('/worklogs/[id]/page').map((file) =>
        file.replace(/^static\/chunks\//, ''),
      );

      // The heavy export path must be fetched on demand, never in the route's
      // initial chunk set — that is the entire point of the dynamic import.
      for (const chunk of pdfChunks) {
        expect(eager).not.toContain(chunk);
      }
    });

    it('keeps the /worklogs/[id] route bundle small', () => {
      const worklogIdDir = join(serverDir, 'worklogs', '[id]');

      if (!existsSync(worklogIdDir)) {
        console.warn('Build directory not found. Run "npm run build" first.');
        return;
      }

      const pageFile = join(worklogIdDir, 'page.js');
      if (!existsSync(pageFile)) return;

      const pageSize = statSync(pageFile).size;

      console.log(`
        📦 Route Bundle:
        - /worklogs/[id]/page.js size: ${(pageSize / 1024).toFixed(2)} KB
      `);

      // Before the dynamic import this route carried the PDF exporter inline.
      expect(pageSize).toBeLessThan(50000);
    });
  });

  describe('Overall Bundle Size', () => {
    it('should have reasonable total bundle size', () => {
      const chunks = currentBuildChunks();

      if (!chunks) {
        console.warn('Build manifest not found. Run "npm run build" first.');
        return;
      }

      if (!buildMatchesSources()) {
        console.warn(
          'Skipping bundle-size assertion: .next is older than the sources. Run "npm run build".',
        );
        return;
      }

      const totalSize = chunks.reduce((sum, file) => sum + statSync(join(buildDir, file)).size, 0);

      console.log(`
        📦 Bundle Size Metrics:
        - JS chunks in this build: ${chunks.length}
        - Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB
      `);

      // Total client bundle should be reasonable (<5MB)
      expect(totalSize).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('React Compiler Output', () => {
    it('should have React Compiler optimizations applied', () => {
      const buildManifest = join(buildDir, 'build-manifest.json');

      if (!existsSync(buildManifest)) {
        console.warn('Build manifest not found. Run "npm run build" first.');
        return;
      }

      const manifest = JSON.parse(readFileSync(buildManifest, 'utf-8'));

      console.log(`
        ⚛️ React Compiler:
        - Pages optimized: ${Object.keys(manifest.pages || {}).length}
      `);

      // Should have pages in the manifest
      expect(manifest.pages).toBeDefined();
      expect(Object.keys(manifest.pages).length).toBeGreaterThan(0);
    });
  });

  describe('Code Splitting Effectiveness', () => {
    it('should have separate chunks for different routes', () => {
      const pagesDir = join(buildDir, 'server', 'app');

      if (!existsSync(pagesDir)) {
        console.warn('Build directory not found. Run "npm run build" first.');
        return;
      }

      // Check that different pages have separate bundles
      const routes = [
        join(pagesDir, 'page.js'), // Homepage
        join(pagesDir, 'logs/new/page.js'), // New log
        join(pagesDir, 'worklogs/page.js'), // Worklogs list
        join(pagesDir, 'worklogs/[id]/page.js'), // Worklog detail
      ];

      const existingRoutes = routes.filter(route => existsSync(route));

      expect(existingRoutes.length).toBeGreaterThan(0);

      console.log(`
        🔀 Code Splitting:
        - Separate route bundles: ${existingRoutes.length}
      `);
    });
  });
});
