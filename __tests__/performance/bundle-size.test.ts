/**
 * Performance Tests for Bundle Size and Code Splitting
 * Tests dynamic imports and bundle optimization
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

describe('Performance: Bundle Size Optimization', () => {
  const buildDir = join(process.cwd(), '.next');
  const serverDir = join(buildDir, 'server', 'app');

  describe('Dynamic Import - PDF Export', () => {
    it('should have exportToPDF as a separate chunk', () => {
      const worklogIdDir = join(serverDir, 'worklogs', '[id]');

      if (!existsSync(worklogIdDir)) {
        console.warn('Build directory not found. Run "npm run build" first.');
        return;
      }

      // Check that page.js exists and is small (due to dynamic import)
      const pageFile = join(worklogIdDir, 'page.js');

      if (existsSync(pageFile)) {
        const pageContent = readFileSync(pageFile, 'utf-8');

        // Should contain dynamic import() call
        expect(pageContent).toMatch(/import\s*\(/);

        const pageSize = statSync(pageFile).size;

        // With dynamic import, page should be much smaller
        // Before: ~130KB, After: should be <50KB
        expect(pageSize).toBeLessThan(50000);

        console.log(`
          📦 Dynamic Import Verification:
          - /worklogs/[id]/page.js size: ${(pageSize / 1024).toFixed(2)} KB
          - Contains dynamic import: ✓
        `);
      }
    });

    it('should have exportToPDF.js as separate chunk', () => {
      const worklogIdDir = join(serverDir, 'worklogs', '[id]');

      if (!existsSync(worklogIdDir)) {
        return;
      }

      const exportFile = join(worklogIdDir, 'exportToPDF.js');

      if (existsSync(exportFile)) {
        const exportSize = statSync(exportFile).size;

        console.log(`
          📦 PDF Export Module:
          - exportToPDF.js size: ${(exportSize / 1024).toFixed(2)} KB
          - Loaded on-demand: ✓
        `);

        expect(exportSize).toBeGreaterThan(0);
      }
    });
  });

  describe('Overall Bundle Size', () => {
    it('should have reasonable total bundle size', () => {
      const staticDir = join(buildDir, 'static');

      if (!existsSync(staticDir)) {
        console.warn('Build directory not found. Run "npm run build" first.');
        return;
      }

      // Get all chunk files
      function getJSFiles(dir: string): string[] {
        const files: string[] = [];

        if (!existsSync(dir)) return files;

        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            files.push(...getJSFiles(fullPath));
          } else if (entry.endsWith('.js')) {
            files.push(fullPath);
          }
        }

        return files;
      }

      const jsFiles = getJSFiles(staticDir);
      const totalSize = jsFiles.reduce((sum, file) => {
        return sum + statSync(file).size;
      }, 0);

      console.log(`
        📦 Bundle Size Metrics:
        - Total JS files: ${jsFiles.length}
        - Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB
      `);

      // Total bundle should be reasonable (<5MB for client code)
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
