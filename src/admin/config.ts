/**
 * Sveltia CMS configuration for the Slow Dough Pizza Co. website.
 *
 * Written in TypeScript (instead of the conventional admin/config.yml) so that:
 *   • the configuration is type-checked against Sveltia's `CmsConfig` type (`npm run lint`);
 *   • paths can be derived from Vite's BASE_URL (the site lives under
 *     https://smagara.github.io/SlowDoughPizzaSite_Sveltia/ in production and "/" locally);
 *   • shared validation rules (see SAFE_TEXT) are defined once and reused.
 *
 * Field names MUST match the shapes in src/types.ts and the files under /content.
 *
 * Two operating modes, no code change required:
 *   • Production (GitHub Pages): "Sign in with GitHub" → OAuth through the Sveltia CMS
 *     Authenticator (see `backend.base_url`). Every save creates a branch + pull request
 *     (Editorial Workflow); a reviewer approves and merges on GitHub.
 *   • Local development: on localhost Sveltia additionally offers "Work with Local Repository"
 *     (File System Access API in Chrome/Edge). Edits are written straight to the working
 *     copy and the Vite dev server hot-reloads the site — no GitHub round-trip.
 */
import type { CmsConfig } from '@sveltia/cms';

// ---------------------------------------------------------------------------
// Deployment constants — keep in sync with .github/workflows/deploy.yml
// ---------------------------------------------------------------------------
const GITHUB_REPO = 'smagara/SlowDoughPizzaSite_Sveltia';
const SITE_URL = 'https://smagara.github.io/SlowDoughPizzaSite_Sveltia/';

/**
 * OAuth helper that exchanges the GitHub authorization code for a token.
 * GitHub Pages is static, so this tiny service must be hosted elsewhere — the recommended
 * option is the official Sveltia CMS Authenticator on Cloudflare Workers (free tier):
 * https://github.com/sveltia/sveltia-cms-auth
 *
 * Provided at build time through the VITE_CMS_OAUTH_BASE_URL variable (GitHub Actions →
 * repository variable CMS_OAUTH_BASE_URL). Until it is configured, the editor offers only
 * "Sign In Using Access Token" (a fine-grained GitHub personal access token with Contents +
 * Pull requests read/write on this repository) instead of a "Sign in with GitHub" button that
 * could not work.
 */
const OAUTH_BASE_URL: string = import.meta.env?.VITE_CMS_OAUTH_BASE_URL || '';

// "/" locally, "/SlowDoughPizzaSite_Sveltia/" on GitHub Pages. (Optional chaining keeps this file importable
// from plain Node — scripts/validate-content.ts reuses the field rules below as the CI validator.)
const BASE_URL: string = import.meta.env?.BASE_URL ?? '/';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
/**
 * Single-line / plain-text fields: reject anything that could be read as markup.
 * (React escapes output anyway — this is the "don't let it in" layer so reviewers never
 * see <script> in a pull request diff.)
 */
const SAFE_TEXT: [string, string] = [
  '^[^<>]*$',
  'Angle brackets < and > are not allowed — please use plain text.',
];

/**
 * Markdown body: blockquotes legitimately start with ">", so only reject HTML-tag-like
 * sequences such as <script, </div, <!-- or <?xml. A bare "<" in prose (e.g. "< 40°F") is fine.
 */
const SAFE_MARKDOWN: [string, string] = [
  '^(?:[^<]|<(?![a-zA-Z\\/!?]))*$',
  'HTML tags (e.g. <script>, <div>) are not allowed — use the formatting toolbar instead.',
];

/** Simple price format: whole dollars or dollars + cents, no currency symbol. */
const MENU_TAGS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Spicy',
  'House Favorite',
  'House Specialty',
  'House-Made',
  'Neapolitan Classic',
  'Ancient Classic',
  'Historic Recipe',
  'Traditional',
  'Signature Dough',
  'Seasonal',
  'New',
];

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export const config: CmsConfig = {
  load_config_file: false, // everything is defined here; do not fetch admin/config.yml

  app_title: 'Slow Dough Pizza Co. — Content Editor',
  site_url: SITE_URL,
  display_url: SITE_URL,
  logo: { src: `${BASE_URL}admin/logo.svg`, show_in_header: true },
  show_preview_links: false,
  logout_redirect_url: BASE_URL,

  backend: {
    name: 'github',
    repo: GITHUB_REPO,
    // `branch` is deliberately NOT set: Sveltia then detects and edits the repository's *default*
    // branch. A hard-coded name that differs from where the content lives (e.g. `main` vs an
    // older `master`) makes the editor silently show empty collections, because it reads a
    // branch without `content/`. The deploy workflow publishes `main`, so keep `main` as the
    // default branch (Settings → General → Default branch) — see README "Troubleshooting".
    auth_scope: 'repo',
    ...(OAUTH_BASE_URL
      ? { base_url: OAUTH_BASE_URL, auth_endpoint: 'auth', auth_methods: ['oauth', 'token'] }
      : { auth_methods: ['token'] }),
    // Editorial Workflow: each change lives on its own branch `cms/<collection>/<slug>` and
    // is proposed as a pull request against `main`, labelled with this prefix.
    cms_label_prefix: 'sveltia-cms/',
    squash_merges: true,
    commit_messages: {
      create: 'content: add {{collection}} “{{slug}}”',
      update: 'content: update {{collection}} “{{slug}}”',
      delete: 'content: remove {{collection}} “{{slug}}”',
      uploadMedia: 'content: upload “{{path}}”',
      deleteMedia: 'content: delete “{{path}}”',
    },
  },

  // Every save → branch + pull request. Nothing reaches `main` without review.
  publish_mode: 'editorial_workflow',

  // No image fields are exposed yet; kept for completeness (uploads would land in public/uploads).
  media_folder: 'public/uploads',
  public_folder: `${BASE_URL}uploads`,

  media_libraries: { default: { config: { max_file_size: 0 } } },

  slug: { encoding: 'ascii', clean_accents: true, lowercase: true, maxlength: 60 },

  output: { omit_empty_optional_fields: false, json: { indent_style: 'space', indent_size: 2 } },

  collections: [
    // -----------------------------------------------------------------------
    // Blog posts — one Markdown file per essay under content/blog/
    // -----------------------------------------------------------------------
    {
      name: 'blog',
      label: 'Blog Posts',
      label_singular: 'Blog Post',
      icon: 'article',
      description:
        'Essays shown in “The Baker’s Journal”. Saving creates a pull request for review; the post appears on the website once the request is approved and merged.',
      folder: 'content/blog',
      extension: 'md',
      format: 'yaml-frontmatter',
      create: true,
      delete: true,
      duplicate: true,
      publish: false, // review + merge happen on GitHub, not from the editor
      identifier_field: 'title',
      slug: {
        template: '{{title}}',
        editable: ['create'],
        hint: 'Used for the file name — lowercase letters, numbers and dashes only.',
        pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', 'Use lowercase letters, numbers and dashes only.'],
      },
      summary: '{{title}} — {{author}}',
      sortable_fields: { fields: ['date', 'title', 'author'], default: { field: 'date', direction: 'descending' } },
      thumbnail: false,
      editor: { preview: true },
      fields: [
        {
          name: 'title',
          label: 'Title',
          widget: 'string',
          required: true,
          minlength: 3,
          maxlength: 120,
          pattern: SAFE_TEXT,
        },
        {
          name: 'subtitle',
          label: 'Subtitle',
          widget: 'string',
          required: false,
          maxlength: 200,
          pattern: SAFE_TEXT,
          hint: 'One sentence shown in italics under the title.',
        },
        {
          name: 'author',
          label: 'Author',
          widget: 'string',
          required: true,
          maxlength: 60,
          pattern: SAFE_TEXT,
          default: 'Marco Bellini',
        },
        {
          name: 'authorRole',
          label: 'Author role',
          widget: 'string',
          required: false,
          maxlength: 60,
          pattern: SAFE_TEXT,
          default: 'Head Baker & Pizzaiolo',
        },
        {
          name: 'date',
          label: 'Publish date',
          widget: 'datetime',
          type: 'date',
          format: 'YYYY-MM-DD',
          default: '{{now}}',
          required: true,
          hint: 'Posts are listed newest first.',
        },
        {
          name: 'artType',
          label: 'Illustration',
          widget: 'select',
          options: [
            { label: 'Dough & proofing boxes', value: 'dough' },
            { label: 'Wood-fired oven', value: 'oven' },
          ],
          default: 'dough',
          required: true,
        },
        {
          name: 'excerpt',
          label: 'Excerpt',
          widget: 'text',
          required: true,
          minlength: 20,
          maxlength: 300,
          pattern: SAFE_TEXT,
          hint: 'Short teaser shown on the post card (max 300 characters).',
        },
        {
          name: 'keyTakeaways',
          label: 'Key takeaways',
          label_singular: 'Takeaway',
          widget: 'list',
          required: false,
          min: 0,
          max: 5,
          field: { name: 'takeaway', label: 'Takeaway', widget: 'string', maxlength: 200, pattern: SAFE_TEXT },
          hint: 'Up to five bullet points shown as “Essential Insights”.',
        },
        {
          name: 'visible',
          label: 'Show on website',
          widget: 'boolean',
          default: true,
          required: false,
          hint: 'Switch off to hide the post without deleting it.',
        },
        {
          name: 'body',
          label: 'Essay',
          widget: 'markdown',
          required: true,
          modes: ['rich_text', 'raw'],
          buttons: ['bold', 'italic', 'heading-two', 'heading-three', 'quote', 'bulleted-list', 'numbered-list', 'link'],
          editor_components: [], // no images / code blocks / raw HTML
          allow_nested_components: false,
          pattern: SAFE_MARKDOWN,
          hint: 'Use “Heading 2” for section titles and “Quote” for a pull-quote. Plain text only — HTML is not allowed.',
        },
      ],
    },

    // -----------------------------------------------------------------------
    // Site content — single files under content/ (menu, announcement, hours)
    // -----------------------------------------------------------------------
    {
      name: 'site',
      label: 'Site Content',
      icon: 'storefront',
      description: 'Day-to-day updates: the daily menu, the dough announcement banner and opening hours.',
      publish: false,
      editor: { preview: true },
      files: [
        // ---- Daily Menu -----------------------------------------------------
        {
          name: 'menu',
          label: 'Daily Menu',
          icon: 'restaurant_menu',
          file: 'content/menu.json',
          format: 'json',
          fields: [
            {
              name: 'intro',
              label: 'Menu introduction',
              widget: 'text',
              required: true,
              maxlength: 400,
              pattern: SAFE_TEXT,
            },
            {
              name: 'categories',
              label: 'Menu sections',
              label_singular: 'Menu section',
              widget: 'list',
              required: true,
              min: 1,
              max: 8,
              collapsed: 'auto',
              summary: '{{fields.title}}',
              fields: [
                {
                  name: 'title',
                  label: 'Section title',
                  widget: 'string',
                  required: true,
                  maxlength: 80,
                  pattern: SAFE_TEXT,
                  hint: 'Text in parentheses is hidden from the filter buttons, e.g. “Neapolitan Pizzas (Pizze Napoletane)”.',
                },
                {
                  name: 'subtitle',
                  label: 'Section description',
                  widget: 'string',
                  required: false,
                  maxlength: 200,
                  pattern: SAFE_TEXT,
                },
                {
                  name: 'items',
                  label: 'Items',
                  label_singular: 'Item',
                  widget: 'list',
                  required: true,
                  min: 1,
                  max: 30,
                  collapsed: 'auto',
                  summary: '{{fields.name}} — ${{fields.price}}',
                  fields: [
                    {
                      name: 'name',
                      label: 'Name',
                      widget: 'string',
                      required: true,
                      minlength: 2,
                      maxlength: 80,
                      pattern: SAFE_TEXT,
                    },
                    {
                      name: 'italianName',
                      label: 'Italian name',
                      widget: 'string',
                      required: false,
                      maxlength: 80,
                      pattern: SAFE_TEXT,
                    },
                    {
                      name: 'description',
                      label: 'Description',
                      widget: 'text',
                      required: true,
                      maxlength: 300,
                      pattern: SAFE_TEXT,
                    },
                    {
                      name: 'price',
                      label: 'Price (USD)',
                      widget: 'number',
                      value_type: 'float',
                      min: 0,
                      max: 500,
                      step: 0.5,
                      required: true,
                      before_input: '$',
                    },
                    {
                      name: 'tags',
                      label: 'Badges',
                      widget: 'select',
                      multiple: true,
                      required: false,
                      options: MENU_TAGS,
                      dropdown_threshold: 0,
                      hint: 'Dietary and highlight badges shown under the item.',
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ---- Dough announcement banner --------------------------------------
        {
          name: 'announcement',
          label: 'Dough Announcement',
          icon: 'campaign',
          file: 'content/announcement.json',
          format: 'json',
          fields: [
            {
              name: 'enabled',
              label: 'Show the banner',
              widget: 'boolean',
              default: true,
              required: false,
            },
            {
              name: 'headline',
              label: 'Headline',
              widget: 'string',
              required: true,
              minlength: 3,
              maxlength: 80,
              pattern: SAFE_TEXT,
              hint: 'Shown in the dark strip at the very top of every page, e.g. “Today’s Dough: 72-Hour Cold Cellar Ferment”.',
            },
            {
              name: 'detail',
              label: 'Detail (optional)',
              widget: 'string',
              required: false,
              maxlength: 80,
              pattern: SAFE_TEXT,
              hint: 'Shorter note shown after the headline on wider screens, e.g. “Doors open at 4:30 PM (Wed–Sun)”.',
            },
          ],
        },

        // ---- Opening hours ----------------------------------------------------
        {
          name: 'hours',
          label: 'Opening Hours',
          icon: 'schedule',
          file: 'content/hours.json',
          format: 'json',
          fields: [
            {
              name: 'days',
              label: 'Weekly schedule',
              widget: 'list',
              allow_add: false,
              allow_remove: false,
              allow_reorder: false,
              allow_duplicate: false,
              min: 7,
              max: 7,
              collapsed: 'auto',
              summary: '{{fields.day}}: {{fields.hours}}',
              fields: [
                { name: 'day', label: 'Day', widget: 'string', readonly: true, required: true },
                {
                  name: 'hours',
                  label: 'Hours',
                  widget: 'string',
                  required: true,
                  maxlength: 40,
                  pattern: SAFE_TEXT,
                  hint: 'e.g. “4:30 PM – 9:30 PM” or “Closed”.',
                },
                {
                  name: 'statusNote',
                  label: 'Note',
                  widget: 'string',
                  required: false,
                  maxlength: 80,
                  pattern: SAFE_TEXT,
                },
                {
                  name: 'isClosed',
                  label: 'Closed this day',
                  widget: 'boolean',
                  default: false,
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
