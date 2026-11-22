import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SiteHeader } from './ui/SiteHeader';
import './theme/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteHeader />
    <div className="app-frame">
      <App />
    </div>
  </StrictMode>,
);
