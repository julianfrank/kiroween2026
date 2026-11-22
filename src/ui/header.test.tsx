// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_VERSION, SiteHeader } from './SiteHeader';
import { appTitle, setAppTitle } from './title';

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

describe('title', () => {
  it('is "My Money Manager" only while net worth is above zero', () => {
    expect(appTitle(1)).toBe('My Money Manager');
    expect(appTitle(0)).toBe('Scary Money Manager');
    expect(appTitle(-500)).toBe('Scary Money Manager');
    expect(appTitle(null)).toBe('Scary Money Manager'); // before the books are open
  });

  it('the header and the page title follow it', () => {
    render(<SiteHeader />);
    act(() => setAppTitle('My Money Manager'));
    expect(screen.getByText('My Money Manager')).toBeTruthy();
    expect(document.title).toBe('My Money Manager');
    act(() => setAppTitle('Scary Money Manager'));
    expect(screen.getByText('Scary Money Manager')).toBeTruthy();
    expect(document.title).toBe('Scary Money Manager');
  });
});