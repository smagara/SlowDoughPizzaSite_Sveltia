/**
 * Site-styled preview templates for the Sveltia CMS editor.
 *
 * Sveltia renders these React components in the preview pane (a sandboxed iframe) whenever the
 * matching entry is edited: file collections are matched by *file* name (menu, announcement,
 * hours), folder collections by *collection* name (blog). The markup mirrors the public site's
 * components (MenuSection, Navbar banner, HoursAndLocation, ArticlesSection) using the plain CSS
 * classes defined in ./preview.css — Tailwind is not available inside the preview iframe.
 *
 * Implementation notes
 *   • Sveltia bundles its own React (19.x) and renders these components with it. They are written
 *     as pure, hook-free function components so the JSX produced by this project's React runtime
 *     is interchangeable (React elements are plain objects keyed by a global Symbol).
 *   • Entry data arrives as an Immutable.js Map (`entry.get('data')`); `toJS()` gives plain data.
 *   • The blog body is rendered through `widgetFor('body')`, Sveltia's own sanitised Markdown
 *     preview, so the template never handles raw HTML.
 */
import type { CustomPreviewTemplateProps } from '@sveltia/cms';
import type { ReactNode } from 'react';

type Data = Record<string, any>;

const data = (props: CustomPreviewTemplateProps): Data => {
  const map = props.entry?.get?.('data');
  return map && typeof map.toJS === 'function' ? (map.toJS() as Data) : {};
};

const text = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

const formatDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const readTime = (body: string): string => `${Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200))} min read`;

/** Chrome around every preview: a small "this is how it looks on the website" frame. */
const Frame = ({ section, children }: { section: string; children: ReactNode }) => (
  <div className="sd-frame">
    <div className="sd-frame-bar">
      <span className="sd-dot" />
      <span className="sd-dot" />
      <span className="sd-dot" />
      <span className="sd-frame-title">Preview · {section} — as it will appear on slowdoughpizza.com</span>
    </div>
    <div className="sd-page">{children}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Daily Menu  (content/menu.json → MenuSection.tsx)
// ---------------------------------------------------------------------------
const badgeClass = (tag: string) =>
  tag === 'Vegetarian' || tag === 'Vegan' ? 'sd-badge sd-badge-green' : tag === 'House Favorite' ? 'sd-badge sd-badge-terra' : 'sd-badge';

export const MenuPreview = (props: CustomPreviewTemplateProps) => {
  const d = data(props);
  const categories: Data[] = Array.isArray(d.categories) ? d.categories : [];
  return (
    <Frame section="Our Daily Menu">
      <section className="sd-section">
        <div className="sd-center">
          <span className="sd-eyebrow">Seasonal Artisanal Selections</span>
          <h2 className="sd-h2">Our Daily Menu</h2>
          <p className="sd-lede">{text(d.intro) || <em className="sd-empty">Menu introduction…</em>}</p>
        </div>
        <div className="sd-pills">
          <span className="sd-pill sd-pill-active">Full Menu</span>
          {categories.map((c, i) => (
            <span key={i} className="sd-pill">
              {text(c.title).split('(')[0].trim() || `Section ${i + 1}`}
            </span>
          ))}
        </div>
        {categories.length === 0 && <p className="sd-empty">No menu sections yet — add one on the left.</p>}
        {categories.map((c, i) => (
          <div key={i} className="sd-category">
            <div className="sd-category-head">
              <h3 className="sd-h3">{text(c.title) || <em className="sd-empty">Section title</em>}</h3>
              {text(c.subtitle) && <p className="sd-category-sub">{text(c.subtitle)}</p>}
            </div>
            <div className="sd-grid">
              {(Array.isArray(c.items) ? c.items : []).map((item: Data, j: number) => {
                const tags: string[] = Array.isArray(item.tags) ? item.tags.map(text) : [];
                return (
                  <div key={j} className="sd-card">
                    <div className="sd-card-top">
                      <div>
                        <h4 className="sd-h4">{text(item.name) || <em className="sd-empty">Item name</em>}</h4>
                        {text(item.italianName) && <span className="sd-italian">{text(item.italianName)}</span>}
                      </div>
                      <span className="sd-price">{item.price === '' || item.price === undefined ? '$—' : `$${item.price}`}</span>
                    </div>
                    <p className="sd-desc">{text(item.description)}</p>
                    {tags.length > 0 && (
                      <div className="sd-tags">
                        {tags.map((t) => (
                          <span key={t} className={badgeClass(t)}>
                            {(t === 'Vegetarian' || t === 'Vegan') && <span className="sd-leaf">❧</span>}
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </Frame>
  );
};

// ---------------------------------------------------------------------------
// Dough Announcement  (content/announcement.json → Navbar.tsx top strip)
// ---------------------------------------------------------------------------
export const AnnouncementPreview = (props: CustomPreviewTemplateProps) => {
  const d = data(props);
  const enabled = d.enabled !== false;
  const headline = text(d.headline);
  const detail = text(d.detail);
  return (
    <Frame section="Top of every page">
      {enabled && headline ? (
        <div className="sd-banner">
          <span className="sd-banner-dot" />
          <span>{headline}</span>
          {detail && (
            <>
              <span className="sd-banner-sep">•</span>
              <span className="sd-banner-detail">{detail}</span>
            </>
          )}
        </div>
      ) : (
        <div className="sd-banner sd-banner-off">
          {enabled ? 'The banner is hidden until a headline is entered.' : 'The banner is switched off — nothing is shown at the top of the site.'}
        </div>
      )}
      <div className="sd-nav">
        <div>
          <div className="sd-brand">Slow Dough</div>
          <div className="sd-brand-sub">Artisan Pizza Co. • 72H Aged</div>
        </div>
        <div className="sd-nav-links">
          <span className="sd-nav-active">The Differentiator</span>
          <span>The Craft</span>
          <span>Menu</span>
          <span>Blog &amp; Essays</span>
          <span>Hours &amp; Location</span>
        </div>
      </div>
      <div className="sd-hero">
        <span className="sd-chip">⌛ The 72-Hour Cold Cellar Ferment</span>
        <h1 className="sd-h1">Time is our primary ingredient.</h1>
        <p className="sd-lede sd-left">
          Most pizzerias rush their dough in four hours. At Slow Dough, we rest every batch for a full <strong>72 to 96 hours</strong> in a cold stone cellar…
        </p>
      </div>
    </Frame>
  );
};

// ---------------------------------------------------------------------------
// Opening Hours  (content/hours.json → HoursAndLocation.tsx)
// ---------------------------------------------------------------------------
export const HoursPreview = (props: CustomPreviewTemplateProps) => {
  const d = data(props);
  const days: Data[] = Array.isArray(d.days) ? d.days : [];
  return (
    <Frame section="Store Hours & Location">
      <section className="sd-section">
        <div className="sd-center">
          <span className="sd-eyebrow">Visit the Pizzeria</span>
          <h2 className="sd-h2">Store Hours &amp; Location</h2>
        </div>
        <div className="sd-panel">
          <div className="sd-panel-head">
            <span className="sd-h3">🕓 Weekly Schedule</span>
            <span className="sd-mono-chip">Dough Cycle</span>
          </div>
          {days.map((day, i) => {
            const closed = Boolean(day.isClosed);
            return (
              <div key={i} className={`sd-hours-row${closed ? ' sd-closed' : ''}`}>
                <div className="sd-hours-day">
                  <span className="sd-day">{text(day.day)}</span>
                  {text(day.statusNote) && <span className="sd-note">({text(day.statusNote)})</span>}
                </div>
                <span className={closed ? 'sd-hours-closed' : 'sd-hours-open'}>{text(day.hours) || '—'}</span>
              </div>
            );
          })}
        </div>
      </section>
    </Frame>
  );
};

// ---------------------------------------------------------------------------
// Blog post  (content/blog/*.md → ArticlesSection.tsx card + essay modal)
// ---------------------------------------------------------------------------
export const BlogPreview = (props: CustomPreviewTemplateProps) => {
  const d = data(props);
  const takeaways: string[] = Array.isArray(d.keyTakeaways) ? d.keyTakeaways.map(text) : [];
  const body = text(d.body);
  const hidden = d.visible === false;
  return (
    <Frame section="The Baker’s Journal">
      {hidden && <div className="sd-ribbon">“Show on website” is off — this post is not shown on the site.</div>}
      <section className="sd-section sd-journal">
        <article className="sd-post-card">
          <div className="sd-meta">
            <span>👤 {text(d.author) || 'Author'}{text(d.authorRole) ? ` (${text(d.authorRole)})` : ''}</span>
            <span>•</span>
            <span>📅 {formatDate(text(d.date))}</span>
            <span>•</span>
            <span>🕓 {readTime(body)}</span>
          </div>
          <h3 className="sd-post-title">{text(d.title) || <em className="sd-empty">Post title</em>}</h3>
          {text(d.subtitle) && <p className="sd-post-subtitle">“{text(d.subtitle)}”</p>}
          <p className="sd-post-excerpt">{text(d.excerpt)}</p>
          {takeaways.length > 0 && (
            <div className="sd-insights">
              <span className="sd-insights-label">Essential Insights:</span>
              <ul>
                {takeaways.map((t, i) => (
                  <li key={i}>
                    <span className="sd-check">✓</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="sd-post-foot">
            <span className="sd-mono">Essay • Complete Text Available</span>
            <span className="sd-btn-dark">Read Full Essay →</span>
          </div>
        </article>

        <div className="sd-essay">
          <div className="sd-essay-bar">The Baker’s Journal • Slow Dough Pizza Co.</div>
          <h2 className="sd-h2 sd-left">{text(d.title)}</h2>
          {text(d.subtitle) && <p className="sd-post-subtitle">{text(d.subtitle)}</p>}
          <div className="sd-body">{props.widgetFor('body')}</div>
          <div className="sd-signoff">
            <strong>{text(d.author)}</strong>
            <span>{text(d.authorRole)} • Slow Dough Pizza Co.</span>
          </div>
        </div>
      </section>
    </Frame>
  );
};
