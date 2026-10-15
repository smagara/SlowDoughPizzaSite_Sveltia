/**
 * Vite plugin: import Markdown files with YAML front matter as JSON modules.
 *
 *   import post from '/content/blog/my-post.md';
 *   // post = { frontmatter: { title: '...', ... }, body: '## Markdown…', file: 'my-post' }
 *
 * Parsing happens at build time in Node, so the browser bundle receives plain data and
 * no YAML parser. The Markdown *body* is rendered at runtime by <Markdown /> (react-markdown),
 * which never emits raw HTML — see src/components/Markdown.tsx.
 */
import { parse as parseYaml } from 'yaml';
import type { Plugin } from 'vite';

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface MarkdownModule {
  frontmatter: Record<string, unknown>;
  body: string;
  /** File name without extension — used as the entry slug. */
  file: string;
}

export function parseMarkdownFile(raw: string, id: string): MarkdownModule {
  const file = id.split(/[\\/]/).pop()!.replace(/\.md$/, '');
  const match = raw.match(FRONT_MATTER);

  if (!match) {
    return { frontmatter: {}, body: raw.trim(), file };
  }

  // YAML 1.2 core schema: dates stay strings (2026-09-14), no implicit timestamps / merge keys.
  const frontmatter = (parseYaml(match[1], { schema: 'core' }) ?? {}) as Record<string, unknown>;

  if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error(`${id}: front matter must be a YAML mapping`);
  }

  return { frontmatter, body: match[2].trim(), file };
}

export default function markdownContent(): Plugin {
  return {
    name: 'slow-dough:markdown-content',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.md') || !/[\\/]content[\\/]/.test(id)) return null;
      const mod = parseMarkdownFile(code, id);
      return {
        code: `export default ${JSON.stringify(mod)};`,
        map: null,
      };
    },
  };
}
