import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const safeMarkdown = new Marked({
  breaks: true,
  gfm: true,
  renderer: {
    html() {
      return '';
    },
  },
});

export function renderSafeMarkdown(content: string): string {
  const rendered = safeMarkdown.parse(content) as string;

  return DOMPurify.sanitize(`<div>${rendered}</div>`, {
    ALLOWED_ATTR: [
      'alt',
      'checked',
      'class',
      'disabled',
      'href',
      'src',
      'title',
      'type',
    ],
    ALLOWED_TAGS: [
      'a',
      'blockquote',
      'br',
      'code',
      'del',
      'div',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'img',
      'input',
      'li',
      'ol',
      'p',
      'pre',
      'strong',
      'table',
      'tbody',
      'td',
      'th',
      'thead',
      'tr',
      'ul',
    ],
    FORCE_BODY: true,
  });
}
