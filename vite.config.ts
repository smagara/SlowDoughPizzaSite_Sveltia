import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {defineConfig} from 'vite';
import markdownContent from './tools/vite-plugin-markdown-content.ts';
import contentSecurityPolicy from './tools/vite-plugin-csp.ts';
import adminRedirect from './tools/vite-plugin-admin-redirect.ts';

export default defineConfig(() => {
  return {
    // GitHub Pages serves the site from https://smagara.github.io/SlowDoughPizzaSite_Sveltia/
    // The deploy workflow sets BASE_PATH accordingly; local dev/preview serve from "/".
    base: process.env.BASE_PATH ?? '/',
    plugins: [react(), tailwindcss(), markdownContent(), contentSecurityPolicy(), adminRedirect()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          // Public site
          main: path.resolve(import.meta.dirname, 'index.html'),
          // Sveltia CMS editor (hidden link in the footer → /admin/)
          admin: path.resolve(import.meta.dirname, 'admin/index.html'),
        },
      },
      // The editor entry bundles Sveltia CMS, a pre-built ~2 MB single-page app that cannot be
      // split further from here (its own sub-features are already lazy-loaded chunks). Raising
      // the limit keeps the "chunks are larger than 500 kB" warning from hiding real problems;
      // the public site's own chunk stays well under the default 500 kB.
      chunkSizeWarningLimit: 2600,
    },
    server: {
      // HMR is disabled via the DISABLE_HMR environment variable.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
