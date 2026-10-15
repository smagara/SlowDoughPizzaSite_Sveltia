import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Quote } from 'lucide-react';

/**
 * Renders CMS-authored Markdown (blog post bodies) in the site's typography.
 *
 * Safety model — content is written by a non-technical editor, reviewed in a pull request,
 * and rendered here:
 *   • react-markdown builds React elements directly; it never uses innerHTML, so text can't
 *     become markup. Raw HTML inside the Markdown is dropped entirely (`skipHtml`).
 *   • Only a small whitelist of block/inline elements is rendered; anything else (images,
 *     tables, code, headings other than h2/h3 …) is unwrapped to plain text.
 *   • Link URLs go through react-markdown's default transform, which strips `javascript:`
 *     and other dangerous protocols. External links open in a new tab with rel=noopener.
 */
const ALLOWED_ELEMENTS = ['p', 'h2', 'h3', 'blockquote', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br'];

const components: Components = {
  h2: ({ children }) => (
    <h3 className="font-serif text-2xl font-bold text-[#24211e] pt-2">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-serif text-xl font-bold text-[#24211e] pt-1">{children}</h4>
  ),
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  blockquote: ({ children }) => (
    <div className="my-6 p-5 border-l-3 border-[#c85a32] bg-[#f4ece0]/60 rounded-r-lg">
      <Quote className="w-5 h-5 text-[#c85a32] mb-1" />
      <div className="font-serif italic text-lg text-[#24211e] [&>p]:leading-snug">{children}</div>
    </div>
  ),
  ul: ({ children }) => <ul className="list-disc pl-6 space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-[#24211e]">{children}</strong>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#c85a32] underline underline-offset-2 hover:text-[#8c3d1e]"
    >
      {children}
    </a>
  ),
};

interface MarkdownProps {
  children: string;
  className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ children, className }) => (
  <div className={className}>
    <ReactMarkdown
      allowedElements={ALLOWED_ELEMENTS}
      unwrapDisallowed
      skipHtml
      components={components}
    >
      {children}
    </ReactMarkdown>
  </div>
);
