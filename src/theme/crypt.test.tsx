// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Readiness } from '../ui/Readiness';
import { SetupScreen } from '../ui/SetupScreen';
import { EntryStage, KiroGhost } from './Crypt';

afterEach(cleanup);

describe('the crypt (entry screens)', () => {
  it('sets its own dark theme and draws a scene of flying ghosts that screen readers skip', () => {
    document.documentElement.dataset.theme = 'light';
    const { container } = render(<EntryStage><main>content</main></EntryStage>);
    expect(document.documentElement.dataset.theme).toBe('crypt');
    const scene = container.querySelector('.crypt-scene')!;
    expect(scene.getAttribute('aria-hidden')).toBe('true');
    expect(scene.querySelectorAll('.flyer .kiro-ghost').length).toBe(5);
    expect(scene.querySelectorAll('.ember').length).toBeGreaterThan(10);
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('every ghost has its own gradient, so removing one never blanks the others', () => {
    const { container } = render(<><KiroGhost /><KiroGhost /></>);
    const ids = [...container.querySelectorAll('radialGradient')].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('the loader ghost carries a lantern while working, worries on trouble and cheers when ready', () => {
    const { container, rerender } = render(<Readiness state={{ step: 'downloading', percent: 40 }} onStart={() => {}} />);
    expect(container.querySelector('.sentry .mood-lantern')).not.toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Model download' }).getAttribute('aria-valuenow')).toBe('40');
    expect(screen.getByText('Downloading model 40%')).toBeTruthy();
    rerender(<Readiness state={{ step: 'unsupported', reason: 'Use Chrome' }} onStart={() => {}} />);
    expect(container.querySelector('.sentry .mood-worried')).not.toBeNull();
    rerender(<Readiness state={{ step: 'ready' }} onStart={() => {}} />);
    expect(container.querySelector('.sentry .mood-cheer')).not.toBeNull();
    expect(container.querySelector('.ready-burst')!.textContent).toContain('Ready to Work.');
  });

  it('the setup ghost worries until the books balance, then cheers', () => {
    const { container } = render(<SetupScreen onDone={async () => {}} />);
    fireEvent.change(screen.getAllByPlaceholderText('House, Bank, Cash')[0], { target: { value: 'Cash' } });
    fireEvent.change(screen.getAllByPlaceholderText('40L, 5,00,000')[0], { target: { value: '5000' } });
    expect(container.querySelector('.imbalance-panel.unbalanced .mood-worried')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use difference' }));
    expect(container.querySelector('.imbalance-panel.balanced .mood-cheer')).not.toBeNull();
  });
});
