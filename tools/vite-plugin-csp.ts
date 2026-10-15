/**
 * Vite plugin: inject a Content-Security-Policy <meta> tag into the *public* site at build time.
 *
 * GitHub Pages cannot send custom HTTP headers, so a <meta http-equiv> CSP is the only option.
 * It is a defence-in-depth layer on top of input validation + React escaping: even if a script
 * tag somehow ended up in content, the browser would refuse to execute inline scripts.
 *
 * Only applied during `vite build` (the dev server injects inline scripts for HMR/React Refresh),
 * and only to the public page — the Sveltia CMS admin page talks to GitHub/OAuth endpoints and
 * uses workers/wasm, so it is intentionally left without a meta CSP.
 */
import type { Plugin } from 'vite';

const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Tailwind/React inline style attributes
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export default function contentSecurityPolicy(): Plugin {
  return {
    name: 'slow-dough:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.path.endsWith('index.html') || ctx.path.includes('admin')) return html;
        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: { 'http-equiv': 'Content-Security-Policy', content: POLICY },
              injectTo: 'head-prepend',
            },
          ],
        };
      },
    },
  };
}
