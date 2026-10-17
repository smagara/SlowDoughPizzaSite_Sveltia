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
// Daily menu — intro (content/menu.json), sections (content/menu-sections/*.json)
// and items (content/menu-items/*.json); one file per section/item so that every
// change is its own pull request and workflow card.
// ---------------------------------------------------------------------------
interface SectionFile {
  title: string;
  subtitle?: string;
  order?: number;
}

interface ItemFile {
  name: string;
  italianName?: string;
  description: string;
  price: number;
  tags?: string[];
  /** Title of the section the item belongs to (relation by title). */
  section: string;
  order?: number;
  visible?: boolean;
}

const sectionFiles = import.meta.glob<SectionFile>('../../content/menu-sections/*.json', { eager: true, import: 'default' });
const itemFiles = import.meta.glob<ItemFile>('../../content/menu-items/*.json', { eager: true, import: 'default' });

const byOrder = <T extends { order?: number }>(a: T, b: T) => (a.order ?? 50) - (b.order ?? 50);

const sections = Object.values(sectionFiles).slice().sort(byOrder);
const sectionIds = uniqueSlugs(sections.map((s) => s.title));

const items = Object.values(itemFiles)
  .filter((item) => item.visible !== false)
  .slice()
  .sort((a, b) => byOrder(a, b) || a.name.localeCompare(b.name));

const itemIds = uniqueSlugs(items.map((item) => item.name));
const itemIdOf = new Map(items.map((item, i) => [item, itemIds[i]]));

const knownSections = new Set(sections.map((s) => s.title));
items
  .filter((item) => !knownSections.has(item.section))
  .forEach((item) => console.warn(`[content] menu item “${item.name}” refers to unknown section “${item.section}” and is not shown`));

export const MENU: Menu = {
  intro: menuJson.intro,
  categories: sections.map((section, i): MenuCategory => ({
    id: sectionIds[i],
    title: section.title,
    subtitle: section.subtitle ?? '',
    items: items
      .filter((item) => item.section === section.title)
      .map((item) => ({
        id: itemIdOf.get(item)!,
        name: item.name,
        italianName: item.italianName || undefined,
        description: item.description,
        price: Number(item.price),
        tags: (item.tags ?? []).filter(Boolean),
      })),
  })),
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
