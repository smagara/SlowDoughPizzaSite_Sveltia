import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import markdownContent from './tools/vite-plugin-markdown-content';
import contentSecurityPolicy from './tools/vite-plugin-csp';

export default defineConfig(() => {
  return {
    // GitHub Pages serves the site from https://smagara.github.io/SlowDoughPizzaSite_Sveltia/
    // The deploy workflow sets BASE_PATH accordingly; local dev/preview serve from "/".
    base: process.env.BASE_PATH ?? '/',
    plugins: [react(), tailwindcss(), markdownContent(), contentSecurityPolicy()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          // Public site
          main: path.resolve(__dirname, 'index.html'),
          // Sveltia CMS editor (hidden link in the footer → /admin/)
          admin: path.resolve(__dirname, 'admin/index.html'),
        },
      },
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
