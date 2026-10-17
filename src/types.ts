/**
 * Shapes of the CMS-managed content files under /content.
 * The Sveltia CMS field definitions live in src/admin/config.ts and MUST stay in sync with these.
 */

export interface MenuItem {
  /** Derived at load time from the item name (stable DOM ids / React keys). */
  id: string;
  name: string;
  italianName?: string;
  description: string;
  price: number;
  tags?: string[];
}

export interface MenuCategory {
  /** Derived at load time from the category title. */
  id: string;
  title: string;
  subtitle: string;
  items: MenuItem[];
}

/** Assembled at build time from content/menu.json + menu-sections/*.json + menu-items/*.json. */
export interface Menu {
  intro: string;
  categories: MenuCategory[];
}

export interface BlogPost {
  /** File name of the Markdown entry, e.g. `importance-of-dough-aging`. */
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  authorRole: string;
  /** Derived from the body word count. */
  readTime: string;
  /** ISO date `YYYY-MM-DD` as stored in front matter. */
  date: string;
  /** Human-readable date, e.g. `September 14, 2026`. */
  publishedDate: string;
  excerpt: string;
  artType: 'dough' | 'oven';
  /** Markdown body — rendered with <Markdown /> (never as raw HTML). */
  body: string;
  keyTakeaways: string[];
  visible: boolean;
}

export interface StoreHours {
  day: string;
  hours: string;
  statusNote?: string;
  isClosed?: boolean;
}

export interface Announcement {
  enabled: boolean;
  headline: string;
  detail?: string;
}
