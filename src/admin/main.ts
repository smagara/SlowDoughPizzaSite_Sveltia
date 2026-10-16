/**
 * Entry point of the hidden content editor (/admin/).
 * Bundles Sveltia CMS from npm (version pinned in package.json) and boots it with the typed
 * configuration in ./config.ts. The site-themed skin is applied via ./theme.css; the preview
 * pane renders the site-styled templates in ./preview/.
 */
import CMS from '@sveltia/cms';
import { config } from './config';
import './theme.css';
import previewStyles from './preview/preview.css?raw';
import {
  AnnouncementPreview,
  BlogPreview,
  HoursPreview,
  MenuIntroPreview,
  MenuItemPreview,
  MenuSectionPreview,
} from './preview/templates';

/**
 * Route guard. Sveltia routes by URL hash (#/collections/<name>/…). A hash that names a
 * collection which no longer exists — a bookmark from an older configuration, a typo — makes
 * Sveltia render only “Collection not found” with a Back button after sign-in. Normalise such a
 * hash to the start page before the CMS boots and leave a breadcrumb in the console.
 */
const knownCollections = new Set((config.collections ?? []).flatMap((c) => ('name' in c && c.name ? [c.name] : [])));
const routeMatch = window.location.hash.match(/^#\/collections\/([^/?#]+)/);
if (routeMatch && !knownCollections.has(decodeURIComponent(routeMatch[1]))) {
  console.warn(`[admin] Unknown collection in URL (${window.location.hash}); opening the start page instead.`);
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

// Make the preview pane look like the public website (see ./preview/).
CMS.registerPreviewStyle(previewStyles, { raw: true });
CMS.registerPreviewTemplate('menu-items', MenuItemPreview); // Menu Items (collection name)
CMS.registerPreviewTemplate('menu-sections', MenuSectionPreview); // Menu Sections (collection name)
CMS.registerPreviewTemplate('menu', MenuIntroPreview); // Site Content → Menu Introduction (file name)
CMS.registerPreviewTemplate('announcement', AnnouncementPreview); // Site Content → Dough Announcement
CMS.registerPreviewTemplate('hours', HoursPreview); // Site Content → Opening Hours
CMS.registerPreviewTemplate('blog', BlogPreview); // Blog Posts (collection name)

CMS.init({ config })
  .then(() => {
    document.getElementById('sd-splash')?.remove();
  })
  .catch((error: unknown) => {
    console.error('Sveltia CMS failed to start', error);
    const splash = document.getElementById('sd-splash');
    if (splash) {
      splash.innerHTML = '';
      const msg = document.createElement('p');
      msg.textContent = 'The content editor could not start. Please refresh or contact the site developer.';
      splash.appendChild(msg);
    }
  });
