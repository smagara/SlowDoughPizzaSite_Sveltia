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
import { AnnouncementPreview, BlogPreview, HoursPreview, MenuPreview } from './preview/templates';

// Make the preview pane look like the public website (see ./preview/).
CMS.registerPreviewStyle(previewStyles, { raw: true });
CMS.registerPreviewTemplate('menu', MenuPreview); // Site Content → Daily Menu (file name)
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
