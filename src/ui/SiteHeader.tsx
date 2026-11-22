import { KiroGhost } from '../theme/Crypt';
import '../theme/header.css';
import { useAppTitle } from './title';

export const APP_VERSION = __APP_VERSION__;
export const AUTHOR = 'Julian Frank';
export const REPO_URL = 'https://github.com/julianfrank/kiroween2026';
export const KIRO_URL = 'https://kiro.dev';

function GitHubMark() {
  // The GitHub mark (Octicons "mark-github", MIT licence), in its usual single colour.
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

/**
 * The fixed, floating header on every screen. It always uses the crypt's colours, whatever the main app's
 * net-worth theme is, so it reads as the frame around the whole app.
 */
export function SiteHeader() {
  const title = useAppTitle();
  return (
    <header className="site-header" aria-label="About this app">
      <div className="site-header-inner">
        <span className="site-header-ghost" aria-hidden="true">
          <KiroGhost size={30} mood="happy" />
        </span>
        <span className="site-title" aria-live="polite">{title}</span>
        <span className="site-version" title="Build version from package.json">
          v{APP_VERSION}
        </span>
        <span className="site-spacer" />
        <span className="site-author">
          <span className="site-label">by</span> {AUTHOR}
        </span>
        <a className="site-link" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub (opens in a new tab)">
          <GitHubMark />
          <span className="site-link-text">julianfrank/kiroween2026</span>
        </a>
        <a className="site-link site-kiro" href={KIRO_URL} target="_blank" rel="noopener noreferrer" aria-label="Made with Kiro (opens kiro.dev in a new tab)">
          <span className="site-label">Made with</span> <b>Kiro</b>
        </a>
      </div>
    </header>
  );
}
