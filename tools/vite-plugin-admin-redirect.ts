/**
 * Dev-server counterpart of public/admin.html: `/admin` (no trailing slash) would otherwise be
 * answered by Vite's SPA fallback with the public site's index.html. In production the static
 * public/admin.html takes care of it (GitHub Pages serves `/admin` from `admin.html`).
 */
import type { Plugin } from 'vite';

export default function adminRedirect(): Plugin {
  return {
    name: 'slow-dough:admin-redirect',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (/^\/admin(?:[?#]|$)/.test(url)) {
          res.statusCode = 302;
          res.setHeader('Location', url.replace(/^\/admin/, '/admin/'));
          res.end();
          return;
        }
        next();
      });
    },
  };
}
