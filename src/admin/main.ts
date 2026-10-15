/**
 * Entry point of the hidden content editor (/admin/).
 * Bundles Sveltia CMS from npm (version pinned in package.json) and boots it with the typed
 * configuration in ./config.ts. The site-themed skin is applied via ./theme.css.
 */
import CMS from '@sveltia/cms';
import { config } from './config';
import './theme.css';
import previewStyles from './preview.css?raw';

// Make the live preview pane look like the public website.
CMS.registerPreviewStyle(previewStyles, { raw: true });

CMS.init({ config })
  .then(() => {
    document.getElementById('sd-splash')?.remove();
    document.documentElement.dataset.theme = 'light';
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
