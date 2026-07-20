import { describe, expect, it } from 'vitest';

import { renderSafeMarkdown } from './safe-markdown';

describe('renderSafeMarkdown', () => {
  it('removes executable HTML and dangerous attributes', () => {
    const result = renderSafeMarkdown(`
<script>alert(1)</script>
<img src="x" onerror="alert(1)" style="display:none">
<a href="javascript:alert(1)">unsafe</a>
<iframe src="https://example.com"></iframe>
`);

    expect(result).not.toContain('<script');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<iframe');
  });

  it('preserves common Markdown structures and code blocks', () => {
    const result = renderSafeMarkdown(`
# Title

> quote

| A | B |
| - | - |
| 1 | 2 |

\`\`\`ts
const value = '<safe>';
\`\`\`
`);

    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<blockquote>');
    expect(result).toContain('<table>');
    expect(result).toContain('<pre><code class="language-ts">');
  });
});
