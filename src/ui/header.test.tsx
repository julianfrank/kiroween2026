// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_VERSION, SiteHeader } from './SiteHeader';

afterEach(cleanup);

describe('site header', () => {
  it('shows the title, the package.json version, the author and the two links', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(APP_VERSION).toBe(version);
    render(<SiteHeader />);
    const header = screen.getByRole('banner', { name: 'About this app' });
    expect(within(header).getByText('Scary Money Manager')).toBeTruthy();
    expect(within(header).getByText(`v${version}`)).toBeTruthy();
    expect(header.textContent).toContain('Julian Frank');

    const github = within(header).getByRole('link', { name: /Source code on GitHub/ });
    expect(github.getAttribute('href')).toBe('https://github.com/julianfrank/kiroween2026');
    const kiro = within(header).getByRole('link', { name: /Made with Kiro/ });
    expect(kiro.getAttribute('href')).toBe('https://kiro.dev');
    for (const a of [github, kiro]) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });
});
