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
    expect(markup).not.toMatch(/<link[^>]+(href|rel="stylesheet")/);
  }, 120_000);
});
