import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('single-file build', () => {
  it('outputs one dist/index.html with inlined JS and no external assets', () => {
    execSync('npx vite build', { stdio: 'pipe' });
    expect(existsSync('dist/index.html')).toBe(true);
    const html = readFileSync('dist/index.html', 'utf8');
    // Ignore the bundled JS body so strings inside it cannot cause false matches.
    const markup = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '<script></script>');
    expect(html).toMatch(/<script type="module"[^>]*>/);
    expect(markup).not.toMatch(/<script[^>]+src=/);
    expect(markup).not.toMatch(/<link[^>]+rel="stylesheet"/);
    // Links may only carry embedded data (the favicon), never a file or a URL.
    for (const m of markup.matchAll(/<link[^>]+href="([^"]*)"/g)) expect(m[1]).toMatch(/^data:/);
    expect(markup).toMatch(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/);
  }, 120_000);
});
