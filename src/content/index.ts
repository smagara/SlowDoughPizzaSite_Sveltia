/**
 * Single entry point for all CMS-managed content.
 *
 * The JSON/Markdown files under /content are edited by the pizza shop manager through
 * Sveltia CMS (see /admin). They are imported here at build time, lightly normalised
 * (ids, sorting, derived fields) and exposed with proper TypeScript types.
 */
import announcementJson from '../../content/announcement.json';
import hoursJson from '../../content/hours.json';
import menuJson from '../../content/menu.json';
import type { Announcement, BlogPost, Menu, MenuCategory, StoreHours } from '../types';
import type { MarkdownModule } from '../../tools/vite-plugin-markdown-content';

/** URL/DOM-safe slug from free text (used for React keys and element ids). */
export const slugify = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

/** Make slugs unique within a list by suffixing duplicates (-2, -3, …). */
const uniqueSlugs = (names: string[]): string[] => {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const base = slugify(name);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
};

// ---------------------------------------------------------------------------
// Announcement banner (content/announcement.json)
// ---------------------------------------------------------------------------
export const ANNOUNCEMENT: Announcement = {
  enabled: Boolean(announcementJson.enabled),
  headline: String(announcementJson.headline ?? '').trim(),
  detail: String(announcementJson.detail ?? '').trim() || undefined,
};

// ---------------------------------------------------------------------------
// Store hours (content/hours.json)
// ---------------------------------------------------------------------------
export const STORE_HOURS: StoreHours[] = hoursJson.days.map((d) => ({
  day: d.day,
  hours: d.hours,
  statusNote: d.statusNote || undefined,
  isClosed: Boolean(d.isClosed),
}));

// ---------------------------------------------------------------------------
// Daily menu (content/menu.json)
// ---------------------------------------------------------------------------
const categoryIds = uniqueSlugs(menuJson.categories.map((c) => c.title));

export const MENU: Menu = {
  intro: menuJson.intro,
  categories: menuJson.categories.map((category, i): MenuCategory => {
    const itemIds = uniqueSlugs(category.items.map((item) => item.name));
    return {
      id: categoryIds[i],
      title: category.title,
      subtitle: category.subtitle,
      items: category.items.map((item, j) => ({
        id: itemIds[j],
        name: item.name,
        italianName: item.italianName || undefined,
        description: item.description,
        price: Number(item.price),
        tags: (item.tags ?? []).filter(Boolean),
      })),
    };
  }),
};

export const MENU_CATEGORIES = MENU.categories;

// ---------------------------------------------------------------------------
// Blog posts (content/blog/*.md) — one Markdown file per post
// ---------------------------------------------------------------------------
const blogModules = import.meta.glob<MarkdownModule>('../../content/blog/*.md', {
  eager: true,
  import: 'default',
});

const WORDS_PER_MINUTE = 200;

const formatDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const toPost = ({ frontmatter: fm, body, file }: MarkdownModule): BlogPost => {
  const words = body.split(/\s+/).filter(Boolean).length;
  const date = String(fm.date ?? '').slice(0, 10);
  return {
    id: file,
    slug: file,
    title: String(fm.title ?? file),
    subtitle: String(fm.subtitle ?? ''),
    author: String(fm.author ?? 'Slow Dough Pizza Co.'),
    authorRole: String(fm.authorRole ?? ''),
    readTime: `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`,
    date,
    publishedDate: formatDate(date),
    excerpt: String(fm.excerpt ?? ''),
    artType: fm.artType === 'oven' ? 'oven' : 'dough',
    body,
    keyTakeaways: Array.isArray(fm.keyTakeaways) ? fm.keyTakeaways.map(String) : [],
    visible: fm.visible !== false,
  };
};

/** All posts, newest first. Hidden posts (`visible: false`) are excluded. */
export const BLOG_POSTS: BlogPost[] = Object.values(blogModules)
  .map(toPost)
  .filter((post) => post.visible)
  .sort((a, b) => b.date.localeCompare(a.date));
